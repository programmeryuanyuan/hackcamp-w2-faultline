import type { AggregatedDecision } from './aggregator'

// D3 – On-chain proof via SnapshotRegistry.sol
//
// TODO D3: after deploy on Remix (Base Sepolia):
//   1. Set SNAPSHOT_REGISTRY_ADDRESS + BASE_SEPOLIA_RPC + WALLET_PRIVATE_KEY in .env
//   2. Use viem walletClient.writeContract to call recordDecision()
//   3. This TX hash is the immutable audit trail

export async function recordOnChain(
  _decision: AggregatedDecision,
  _marketQuestion: string,
  _farcasterCastHash: string,
  _orderTxHash: string
): Promise<string | null> {
  console.log('[registry] TODO D3 – on-chain recording not yet wired')
  return null
}
