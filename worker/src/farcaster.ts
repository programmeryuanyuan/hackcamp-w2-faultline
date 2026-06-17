import type { AggregatedDecision } from './aggregator'

export interface CastResult {
  hash: string
  url:  string
}

// D4 – Pre-trade Farcaster cast via Neynar SDK (managed signer)
//
// Key design: cast BEFORE the trade executes.
// The cast timestamp < TX timestamp proves reasoning was pre-committed.
// This is the "unforgeable prediction trail" differentiator vs PolySwarm.
//
// TODO D4: implement with @neynar/nodejs-sdk
//   NeynarAPIClient.publishCast({ signerUuid, text, embeds })
//   Return cast hash to be stored in SnapshotRegistry along with TX hash

export async function castDecision(
  _decision: AggregatedDecision,
  _marketQuestion: string
): Promise<CastResult | null> {
  console.log('[farcaster] TODO D4 – Farcaster cast not yet wired')
  return null
}
