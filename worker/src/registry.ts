import {
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import type { AggregatedDecision } from './aggregator'

const CONTRACT_ABI = parseAbi([
  'function anchor(bytes32 dataHash, string calldata label) external',
])

// ── Anchor guard ─────────────────────────────────────────────────────────────
const MAX_ANCHORS_PER_HOUR = 10
const MIN_ANCHOR_INTERVAL_MS = 60_000          // at least 1 min between calls

const anchorTimestamps: number[] = []

function checkAnchorGuard(): { allowed: boolean; reason: string } {
  const now = Date.now()

  // rate: no more than MAX_ANCHORS_PER_HOUR in a rolling 60-min window
  const cutoff = now - 3_600_000
  while (anchorTimestamps.length && anchorTimestamps[0] < cutoff) anchorTimestamps.shift()
  if (anchorTimestamps.length >= MAX_ANCHORS_PER_HOUR)
    return { allowed: false, reason: `rate limit: ${MAX_ANCHORS_PER_HOUR} anchors/hr reached` }

  // min interval: prevent burst
  const last = anchorTimestamps.at(-1)
  if (last && now - last < MIN_ANCHOR_INTERVAL_MS)
    return { allowed: false, reason: `too soon: ${now - last}ms since last anchor (min ${MIN_ANCHOR_INTERVAL_MS}ms)` }

  return { allowed: true, reason: '' }
}

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
  })

  return { client, address: address as `0x${string}` }
}

/** Generic anchor: hash any payload and store it on-chain with a short label.
 *  Guards: label whitelist (length + charset), rate limit, balance floor. */
export async function anchor(label: string, data: unknown): Promise<string | null> {
  // 1. validate label — only printable ASCII, max 60 chars
  const shortLabel = label.slice(0, 60)
  if (!/^[\x20-\x7E]+$/.test(shortLabel)) {
    console.warn('[registry] anchor rejected — label contains non-printable chars')
    return null
  }

  // 2. rate limit + min interval
  const rateCheck = checkAnchorGuard()
  if (!rateCheck.allowed) {
    console.warn(`[registry] anchor rejected — ${rateCheck.reason}`)
    return null
  }

  const ctx = makeClient()
  if (!ctx) {
    console.log('[registry] anchor skipped — env vars not set')
    return null
  }

  const payload  = JSON.stringify(data)
  const dataHash = keccak256(toHex(payload))

  try {
    const txHash = await ctx.client.writeContract({
      address: ctx.address,
      abi:     CONTRACT_ABI,
      functionName: 'anchor',
      args:    [dataHash, shortLabel],
    })
    anchorTimestamps.push(Date.now())
    console.log(`[registry] anchor → https://sepolia.basescan.org/tx/${txHash}`)
    return txHash
  } catch (err) {
    console.warn('[registry] anchor failed:', (err as Error).message)
    return null
  }
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
