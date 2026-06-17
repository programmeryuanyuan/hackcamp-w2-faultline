import { fetch as undiciFetch, ProxyAgent } from 'undici'

const GAMMA_API = 'https://gamma-api.polymarket.com'
// D3: use process.env.POLYMARKET_API_HOST for CLOB order placement

const dispatcher = process.env.HTTPS_PROXY
  ? new ProxyAgent(process.env.HTTPS_PROXY)
  : undefined

export interface MarketData {
  question:    string
  conditionId: string
  tokenId:     string   // first YES outcome token
  probability: number   // 0–1
  volume24h:   number
  description: string   // resolution criteria — key input for assumption auditor
  endDate:     string   // ISO date string
}

function parseJsonField(field: unknown): unknown[] {
  if (Array.isArray(field)) return field
  if (typeof field === 'string') {
    try { return JSON.parse(field) } catch { return [] }
  }
  return []
}

/** Fetch the highest-volume active binary market and return its YES probability. */
export async function fetchTopMarket(): Promise<MarketData> {
  const url = new URL(`${GAMMA_API}/markets`)
  url.searchParams.set('limit', '1')
  url.searchParams.set('active', 'true')
  url.searchParams.set('closed', 'false')
  url.searchParams.set('order', 'volume24hr')
  url.searchParams.set('ascending', 'false')

  const res = await undiciFetch(url.toString(), {
    dispatcher,
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) throw new Error(`Gamma API HTTP ${res.status}`)

  const data = await res.json() as unknown[]
  const market = data[0] as Record<string, unknown>
  if (!market) throw new Error('No active market returned from Gamma API')

  const tokenIds      = parseJsonField(market.clobTokenIds)
  const outcomePrices = parseJsonField(market.outcomePrices)

  const raw = outcomePrices[0]
  const probability = typeof raw === 'string' ? parseFloat(raw) : Number(raw)

  return {
    question:    String(market.question ?? ''),
    conditionId: String(market.conditionId ?? ''),
    tokenId:     String(tokenIds[0] ?? ''),
    probability: isNaN(probability) ? 0.5 : probability,
    volume24h:   Number(market.volume24hr ?? 0),
    description: String(market.description ?? ''),
    endDate:     String(market.endDate ?? ''),
  }
}
