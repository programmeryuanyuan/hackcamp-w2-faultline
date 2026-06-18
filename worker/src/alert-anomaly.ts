import OpenAI        from 'openai'
import { decide }    from './llm'
import { sendTGAlert } from './notify'
import { anchor }    from './registry'

// Rolling 1-hour price window (one entry per poll cycle, default ~1 min).
// Module-level so it survives across runCycle() calls in the same process.
const PRICE_HISTORY: number[] = []
const MAX_HISTORY = 60

let lastAlertedAt = 0  // epoch ms, 0 = never

const MIN_ALERT_INTERVAL_MS = 30 * 60 * 1_000  // 30 min cooldown

const SYSTEM_PROMPT = `You are a price anomaly detector for a prediction market token.
Your goal: surface genuine price shocks, suppress noise.

Each round you receive:
- data.delta1             : price change vs 1 round ago (signed, 0–1 scale)
- data.deltaMax           : largest single-round move in the last hour
- budget.msSinceLastAlert : ms since last alert
- budget.minIntervalMs    : minimum cooldown between alerts

Rules:
- trigger_alert when: |delta1| > 0.05 OR |deltaMax| > 0.10,
  AND msSinceLastAlert >= minIntervalMs.
  urgency = 'high' if |delta1| > 0.10, 'medium' if > 0.05, else 'low'.
- Otherwise, record_only.

Be conservative with alerts. record_only is fine —
the user sees raw data on the dashboard and can act manually.
Always call exactly one tool.`

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name:        'trigger_alert',
      description: 'Fire a Telegram alert and anchor the anomaly on-chain',
      parameters: {
        type:       'object',
        properties: {
          reason:  { type: 'string', description: 'One sentence: what price anomaly was detected' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['reason', 'urgency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name:        'record_only',
      description: 'Log the observation, no alert',
      parameters: {
        type:       'object',
        properties: {
          note: { type: 'string', description: 'One sentence: why no alert is needed' },
        },
        required: ['note'],
      },
    },
  },
]

/** Call once per poll cycle before alertOnAnomaly to keep history current. */
export function recordPrice(price: number): void {
  PRICE_HISTORY.push(price)
  if (PRICE_HISTORY.length > MAX_HISTORY) PRICE_HISTORY.shift()
}

export async function alertOnAnomaly(tokenId: string, currentPrice: number): Promise<void> {
  const prev   = PRICE_HISTORY.at(-2) ?? currentPrice
  const delta1 = currentPrice - prev
  const deltaMax = PRICE_HISTORY.length < 2
    ? 0
    : Math.max(...PRICE_HISTORY.slice(1).map((p, i) => Math.abs(p - PRICE_HISTORY[i])))

  await decide({
    scenario: 'alert-anomaly',

    data: {
      tokenId,
      currentPrice,
      delta1:   parseFloat(delta1.toFixed(4)),
      deltaMax: parseFloat(deltaMax.toFixed(4)),
    },

    history: [...PRICE_HISTORY],

    budget: {
      msSinceLastAlert: lastAlertedAt === 0 ? Infinity : Date.now() - lastAlertedAt,
      minIntervalMs:    MIN_ALERT_INTERVAL_MS,
      lastAlertedAt:    lastAlertedAt === 0 ? 'never' : new Date(lastAlertedAt).toISOString(),
    },

    systemPrompt: SYSTEM_PROMPT,
    tools:        TOOLS,

    handlers: {
      async trigger_alert(args) {
        const urgency = args.urgency as 'low' | 'medium' | 'high'
        const reason  = args.reason  as string

        lastAlertedAt = Date.now()

        await sendTGAlert(reason, urgency)
        const txHash = await anchor(`anomaly:${tokenId}`, { tokenId, currentPrice, delta1, reason })

        return { txHash: txHash ?? undefined, reason }
      },

      async record_only(args) {
        console.log(`[alert-anomaly] record_only: ${args.note as string}`)
        return { reason: args.note as string }
      },
    },
  })
}
