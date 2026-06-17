import type { AggregatedDecision } from './aggregator'

export interface OrderResult {
  txHash:  string
  orderId: string
}

// D3 – Polymarket CLOB order placement via viem
// Testnet: Amoy (Polygon Amoy)
//
// TODO D3: implement signed CLOB order using:
//   - viem createWalletClient (POLYMARKET_PRIVATE_KEY)
//   - POST https://clob.polymarket.com/order (signed EIP-712 order)
//   - record txHash to SnapshotRegistry

export async function execute(
  _decision: AggregatedDecision,
  _tokenId: string
): Promise<OrderResult | null> {
  console.log('[executor] TODO D3 – order placement not yet wired')
  return null
}
