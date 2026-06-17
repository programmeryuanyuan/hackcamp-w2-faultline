import type { PersonaOpinion } from './personas'

// kept for backward-compat with farcaster.ts / executor.ts / registry.ts
export interface AggregatedDecision {
  probability:   number
  kellyFraction: number
  edge:          number
  opinions:      Array<{ name: string; probability: number; confidence: number; reasoning: string }>
}

export interface AssumptionAudit {
  marketQuestion: string
  marketPrice:    number
  assumptions:    RankedAssumption[]
}

export interface RankedAssumption {
  rank:          number
  fragility:     'high' | 'medium' | 'low'
  assumption:    string
  breakingEvent: string
  timeToBreak:   string
  sources:       string[]  // which personas flagged this
  subMarket:     SubMarketLink | null
}

export interface SubMarketLink {
  question:    string
  probability: number
  conditionId: string
  gap:         number  // parentPrice - subMarketPrice (positive = parent more optimistic)
}

const FRAGILITY_RANK = { high: 0, medium: 1, low: 2 }

function isDuplicate(a: PersonaOpinion, b: PersonaOpinion): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
  const wordsA = new Set(normalize(a.assumption).split(' ').filter(w => w.length > 4))
  const wordsB = normalize(b.assumption).split(' ').filter(w => w.length > 4)
  const overlap = wordsB.filter(w => wordsA.has(w)).length
  return overlap >= 2
}

export function aggregate(
  opinions: PersonaOpinion[],
  marketQuestion: string,
  marketPrice: number,
): AssumptionAudit | null {
  if (opinions.length === 0) return null

  // merge duplicates, collect sources
  const merged: Array<PersonaOpinion & { sources: string[] }> = []
  for (const op of opinions) {
    const existing = merged.find(m => isDuplicate(m, op))
    if (existing) {
      existing.sources.push(op.name)
      // keep the higher fragility rating
      if (FRAGILITY_RANK[op.fragility] < FRAGILITY_RANK[existing.fragility]) {
        existing.fragility = op.fragility
      }
    } else {
      merged.push({ ...op, sources: [op.name] })
    }
  }

  // sort by fragility
  merged.sort((a, b) => FRAGILITY_RANK[a.fragility] - FRAGILITY_RANK[b.fragility])

  const assumptions: RankedAssumption[] = merged.slice(0, 3).map((op, i) => ({
    rank:          i + 1,
    fragility:     op.fragility,
    assumption:    op.assumption,
    breakingEvent: op.breakingEvent,
    timeToBreak:   op.timeToBreak,
    sources:       op.sources,
    subMarket:     null,  // filled in by assumption-search.ts
  }))

  return { marketQuestion, marketPrice, assumptions }
}
