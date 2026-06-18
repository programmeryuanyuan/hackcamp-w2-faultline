// Must run before any import reads process.env
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config()

import OpenAI from 'openai'
import { decide } from './llm'

// ── Hardcoded test data ──────────────────────────────────────────────────────

const SMOKE_DATA = {
  market:      'Will US headline CPI fall below 3.0% by end of Q3 2025?',
  marketPrice:  0.62,
  topAssumption: 'August CPI (published Sept 11) must not rebound above 3.2%',
  fragility:   'high',
  breakingEvent: 'Surprise energy price spike in August data',
}

const SMOKE_HISTORY = [
  { round: 1, action: 'noop',          note: 'Insufficient data' },
  { round: 2, action: 'trigger_alert', note: 'Fed minutes hawkish' },
  { round: 3, action: 'noop',          note: 'Market stable' },
]

const SMOKE_BUDGET = {
  alertsIssuedToday:  2,
  maxAlertsPerDay:    5,
  remainingCapacity:  3,
  lastAlertTimestamp: Date.now() - 3_600_000,
}

const SMOKE_SYSTEM_PROMPT = `You are an assumption fragility monitor for prediction markets.

Given the market data and assumption audit, decide whether to:
- trigger_alert: the assumption's fragility score warrants an immediate alert
- decline: not enough signal to alert right now

Always call exactly one tool. Include a short reason in the "reason" field.`

const SMOKE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name:        'trigger_alert',
      description: 'Issue an alert about a fragile market assumption',
      parameters: {
        type:       'object',
        properties: {
          reason:   { type: 'string', description: 'One sentence: why this assumption is fragile right now' },
          severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          headline: { type: 'string', description: 'Short headline for the alert (max 100 chars)' },
        },
        required: ['reason', 'severity', 'headline'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name:        'decline',
      description: 'Skip this cycle — no alert needed',
      parameters: {
        type:       'object',
        properties: {
          reason: { type: 'string', description: 'One sentence: why no alert is needed' },
        },
        required: ['reason'],
      },
    },
  },
]

const SMOKE_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<{ txHash?: string; reason?: string }>> = {
  async trigger_alert(args) {
    console.log(`[handler:trigger_alert] severity=${args.severity} headline="${args.headline}"`)
    // In production this would post to Farcaster / send a webhook.
    return { reason: args.reason as string }
  },
  async decline(args) {
    console.log(`[handler:decline] reason="${args.reason}"`)
    return { reason: args.reason as string }
  },
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('── llm-smoke: single decide() round ──')
  await decide({
    scenario:     'fragility-monitor',
    data:          SMOKE_DATA,
    history:       SMOKE_HISTORY,
    budget:        SMOKE_BUDGET,
    systemPrompt:  SMOKE_SYSTEM_PROMPT,
    tools:         SMOKE_TOOLS,
    handlers:      SMOKE_HANDLERS,
  })
  console.log('── done ──')
}

main().catch(err => {
  console.error('[smoke] fatal:', err.message)
  process.exit(1)
})
