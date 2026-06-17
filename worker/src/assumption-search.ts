import { fetch as undiciFetch, ProxyAgent } from 'undici'
import { getLlmClient, getLlmModel } from './llm'
import type { RankedAssumption, SubMarketLink } from './aggregator'

const GAMMA_API = 'https://gamma-api.polymarket.com'

const dispatcher = process.env.HTTPS_PROXY
  ? new ProxyAgent(process.env.HTTPS_PROXY)
  : undefined

// extract 2-3 searchable keywords from an assumption string
function extractKeywords(assumption: string): string {
  // remove common filler words, keep nouns and numbers
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'will', 'be', 'to', 'of', 'in', 'that',
    'this', 'must', 'not', 'above', 'below', 'and', 'or', 'for', 'at', 'on',
    'its', 'their', 'with', 'than', 'more', 'less', 'have', 'has', 'had',
  ])
  return assumption
    .toLowerCase()
    .replace(/[^a-z0-9\s%]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 3)
    .join(' ')
}

interface CandidateMarket {
  question:    string
  conditionId: string
  probability: number
}

// returns word-overlap ratio [0,1] between two questions (lowercase, no punctuation)
function questionOverlap(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2))
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let shared = 0
  for (const w of setA) if (setB.has(w)) shared++
  return shared / Math.max(setA.size, setB.size)
}

async function searchCandidates(
  keywords: string,
  excludeConditionId: string,
  parentQuestion: string,
): Promise<CandidateMarket[]> {
  const url = new URL(`${GAMMA_API}/markets`)
  url.searchParams.set('active',     'true')
  url.searchParams.set('closed',     'false')
  url.searchParams.set('limit',      '12')
  url.searchParams.set('order',      'volume24hr')
  url.searchParams.set('ascending',  'false')
  url.searchParams.set('q', keywords)

  try {
    const res = await undiciFetch(url.toString(), {
      dispatcher,
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []

    const data = await res.json() as Record<string, unknown>[]
    return data.map(m => {
      const prices = (() => {
        const field = m.outcomePrices
        if (Array.isArray(field)) return field
        if (typeof field === 'string') {
          try { return JSON.parse(field) } catch { return [] }
        }
        return []
      })()
      const raw = prices[0]
      const prob = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
      return {
        question:    String(m.question ?? ''),
        conditionId: String(m.conditionId ?? ''),
        probability: isNaN(prob) ? 0.5 : prob,
      }
    }).filter(m =>
      m.question.length > 0 &&
      m.conditionId !== excludeConditionId &&
      // secondary guard: reject if question is too similar to parent (Gamma API may return parent via different conditionId)
      questionOverlap(m.question, parentQuestion) < 0.6
    )
  } catch {
    return []
  }
}

async function pickBestMatch(
  assumption: string,
  candidates: CandidateMarket[],
): Promise<CandidateMarket | null> {
  if (candidates.length === 0) return null

  const client = getLlmClient()
  const model  = getLlmModel()

  const list = candidates
    .map((c, i) => `${i + 1}. "${c.question}"`)
    .join('\n')

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a prediction market analyst. Select the best matching market.',
        },
        {
          role: 'user',
          content: `Assumption: "${assumption}"

Candidate markets:
${list}

Which candidate is the closest match to this assumption? Reply with just the number (1-${candidates.length}), or 0 if none are relevant.`,
        },
      ],
      temperature: 0,
      max_tokens:  5,
    })

    const text = response.choices[0]?.message?.content?.trim() ?? '0'
    const idx  = parseInt(text, 10) - 1
    if (idx >= 0 && idx < candidates.length) return candidates[idx]
    return null
  } catch {
    // fallback: return first candidate
    return candidates[0] ?? null
  }
}

export async function findSubMarket(
  assumption: RankedAssumption,
  parentPrice: number,
  parentConditionId: string,
  parentQuestion: string,
): Promise<SubMarketLink | null> {
  const keywords = extractKeywords(assumption.assumption)
  if (!keywords) return null

  const candidates = await searchCandidates(keywords, parentConditionId, parentQuestion)
  const match      = await pickBestMatch(assumption.assumption, candidates)
  if (!match) return null

  const gap = parseFloat((parentPrice - match.probability).toFixed(4))
  // discard sub-markets with trivial gap — they're the same market under a different conditionId
  if (Math.abs(gap) < 0.02) return null

  return {
    question:    match.question,
    probability: match.probability,
    conditionId: match.conditionId,
    gap,
  }
}

export async function enrichWithSubMarkets(
  assumptions: RankedAssumption[],
  parentPrice: number,
  parentConditionId: string,
  parentQuestion: string,
): Promise<void> {
  await Promise.all(
    assumptions.map(async a => {
      a.subMarket = await findSubMarket(a, parentPrice, parentConditionId, parentQuestion)
      if (a.subMarket) {
        console.log(
          `[sub-market] "${a.assumption.slice(0, 50)}…" → ` +
          `"${a.subMarket.question.slice(0, 50)}…" ` +
          `(${(a.subMarket.probability * 100).toFixed(1)}%, gap ${(a.subMarket.gap * 100).toFixed(1)}%)`
        )
      } else {
        console.log(`[sub-market] no match for: "${a.assumption.slice(0, 60)}…"`)
      }
    })
  )
}
