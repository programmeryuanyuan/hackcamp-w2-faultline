import {
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toHex,
  publicActions,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import type { AggregatedDecision } from './aggregator'

const CONTRACT_ABI = parseAbi([
  'function anchor(bytes32 dataHash, string calldata label) external',
])

function makeClient() {
  const rpc     = process.env.BASE_SEPOLIA_RPC
  const privKey = process.env.WALLET_PRIVATE_KEY
  const address = process.env.SNAPSHOT_REGISTRY_ADDRESS

  if (!rpc || !privKey || !address) return null

  const account = privateKeyToAccount(privKey as `0x${string}`)
  const client  = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpc),
  }).extend(publicActions)

  return { client, address: address as `0x${string}` }
}

export async function recordOnChain(
  decision: AggregatedDecision,
  marketQuestion: string,
  farcasterCastHash: string,
  _orderTxHash: string,
): Promise<string | null> {
  const ctx = makeClient()
  if (!ctx) {
    console.log('[registry] skipped — SNAPSHOT_REGISTRY_ADDRESS / BASE_SEPOLIA_RPC / WALLET_PRIVATE_KEY not set')
    return null
  }

  const payload   = JSON.stringify({ decision, marketQuestion, farcasterCastHash })
  const dataHash  = keccak256(toHex(payload))
  const label     = marketQuestion.slice(0, 60)

  try {
    const txHash = await ctx.client.writeContract({
      address: ctx.address,
      abi:     CONTRACT_ABI,
      functionName: 'anchor',
      args:    [dataHash, label],
    })
    console.log(`[registry] anchored → https://sepolia.basescan.org/tx/${txHash}`)
    return txHash
  } catch (err) {
    console.warn('[registry] anchor failed, skipping:', (err as Error).message)
    return null
  }
}
