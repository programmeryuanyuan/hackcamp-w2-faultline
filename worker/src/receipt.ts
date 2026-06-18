import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// __dirname = worker/src/ → same web/public convention as world-model.ts
const RECEIPTS_PATH = resolve(__dirname, '../../web/public/receipts.json')
const MAX_RECEIPTS  = 200

export interface Receipt {
  id:        string
  timestamp: number
  memo:      string  // "action|brief reason"
}

export async function issueReceipt(action: string, reason: string): Promise<string> {
  const id: string  = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const receipt: Receipt = {
    id,
    timestamp: Date.now(),
    memo: `${action}|${reason}`,
  }

  let receipts: Receipt[] = []
  if (existsSync(RECEIPTS_PATH)) {
    try {
      receipts = JSON.parse(readFileSync(RECEIPTS_PATH, 'utf-8')) as Receipt[]
    } catch { /* start fresh on corrupt file */ }
  }

  receipts.unshift(receipt)
  if (receipts.length > MAX_RECEIPTS) receipts.length = MAX_RECEIPTS

  try {
    writeFileSync(RECEIPTS_PATH, JSON.stringify(receipts, null, 2))
  } catch (err) {
    console.warn('[receipt] failed to write receipts.json:', (err as Error).message)
  }

  return id
}
