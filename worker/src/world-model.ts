import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { fetchTopMarket, type MarketData } from './polymarket'
import { withRetry } from './utils'
import type { AssumptionAudit } from './aggregator'

// __dirname = worker/src/ → go up two levels to reach web/public/
// This is always correct regardless of which directory the process is launched from.
const SNAPSHOT_PATH = resolve(__dirname, '../../web/public/snapshot.json')
const MAX_SNAPSHOTS = 500

export interface PricePoint {
  probability: number
  timestamp:   number
}

export interface SwarmDecision {
  timestamp:         number
  opinions:          Array<{ name: string; probability: number; confidence: number; reasoning: string }>
  aggregate:         number
  kellyFraction:     number
  farcasterCastHash: string | null
  txHash:            string | null
}

export interface WorldState {
  market:    MarketData | null
  snapshots: PricePoint[]
}

/** WorldModel maintains the real-time state and writes snapshot.json. */
export class WorldModel {
  private market:    MarketData | null  = null
  private snapshots: PricePoint[]      = []
  private decisions: SwarmDecision[]   = []
  private audits:    (AssumptionAudit & { timestamp: number })[] = []

  /** Fetch latest market data from Polymarket. Call once per cycle. */
  async update(): Promise<void> {
    const data = await withRetry(() => fetchTopMarket(), 'world-model/polymarket')
    if (!data) return

    this.market = data
    this.snapshots.push({ probability: data.probability, timestamp: Date.now() })
    if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift()

    console.log(
      `[world-model] p=${(data.probability * 100).toFixed(1)}% | ` +
      `vol24h=${(data.volume24h / 1000).toFixed(0)}k | ` +
      `"${data.question.slice(0, 60)}…"`
    )
  }

  /** Return current state for persona agents. Intentionally omits raw probability
   *  so callers must pass it explicitly — enforcing the anti-anchoring discipline. */
  getState(): WorldState {
    return {
      market:    this.market,
      snapshots: [...this.snapshots],
    }
  }

  /** Current market price — only read AFTER personas have reasoned independently. */
  getMarketProbability(): number {
    return this.market?.probability ?? 0.5
  }

  /** Append a completed swarm decision for dashboard display. */
  addDecision(decision: SwarmDecision): void {
    this.decisions.unshift(decision)
    if (this.decisions.length > 20) this.decisions.pop()
  }

  /** Append a completed assumption audit for dashboard display. */
  addAudit(audit: AssumptionAudit): void {
    this.audits.unshift({ ...audit, timestamp: Date.now() })
    if (this.audits.length > 20) this.audits.pop()
  }

  /** Write current state to web/public/snapshot.json. */
  writeSnapshot(): void {
    const payload = {
      market:           this.market,
      snapshots:        this.snapshots.slice(-60),
      assumptionAudits: this.audits,
      swarmDecisions:   this.decisions,
      lastUpdated:      Date.now(),
    }
    try {
      writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload, null, 2))
    } catch (err) {
      console.warn('[world-model] failed to write snapshot.json:', (err as Error).message)
    }
  }
}
