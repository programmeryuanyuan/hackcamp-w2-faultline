import OpenAI          from 'openai'
import { decide }      from './llm'
import { sendTGAlert, botState } from './notify'
import { anchor }      from './registry'
import type { AssumptionAudit } from './aggregator'

let lastAlertedAt = 0
const MIN_ALERT_INTERVAL_MS = 30 * 60 * 1_000

const SYSTEM_PROMPT = `You are an assumption fragility monitor for a prediction market.
Your goal: alert only when the market is overconfident AND a core assumption
is genuinely at risk — the combination that creates real mispricing.

Each round you receive the top-ranked assumption from an audit, the market
price, and how many independent personas verified the assumption.

Rules:
- trigger_alert when ALL of:
    data.topAssumption.fragility === 'high'
    AND (data.marketPrice > 0.80 OR data.marketPrice < 0.20)
    AND data.topAssumption.sourcesCount >= 2
    AND budget.msSinceLastAlert >= budget.minIntervalMs
  urgency = 'high' if sourcesCount === 3 AND (price > 0.90 OR price < 0.10)
  urgency = 'medium' otherwise
- Otherwise, record_only.

Be conservative with alerts. record_only is fine —
the user sees full audit details on the dashboard.
Always call exactly one tool.`

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name:        'trigger_alert',
      description: 'Fire a Telegram alert and anchor the assumption anomaly on-chain',
      parameters: {
        type:       'object',
        properties: {
          reason:  { type: 'string', description: 'One sentence: why this assumption is urgent now' },
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

export async function alertOnAnomaly(audit: AssumptionAudit): Promise<void> {
  const top = audit.assumptions[0]
  if (!top) return

  await decide({
    scenario: 'assumption-alert',

    data: {
      marketQuestion:     audit.marketQuestion,
      marketPrice:        audit.marketPrice,
      highFragilityCount: audit.assumptions.filter(a => a.fragility === 'high').length,
      topAssumption: {
        fragility:     top.fragility,
        assumption:    top.assumption,
        breakingEvent: top.breakingEvent,
        timeToBreak:   top.timeToBreak,
        sourcesCount:  top.sources.length,
      },
    },

    history: [],

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

        const URGENCY_ICON = { low: '⚠️', medium: '🚨', high: '🔴' }
        const msg = [
          `*${URGENCY_ICON[urgency]} Faultline Alert [${urgency.toUpperCase()}]*`,
          `*Q:* ${audit.marketQuestion.slice(0, 80)}`,
          `*Price:* ${(audit.marketPrice * 100).toFixed(1)}%`,
          `*Top assumption:* ${top.assumption.slice(0, 100)}`,
          `*Breaking event:* ${top.breakingEvent.slice(0, 80)}`,
          `*Reason:* ${reason}`,
        ].join('\n')

        const dashboardUrl = process.env.DASHBOARD_URL  // must be https:// for TG to accept
        const inlineButtons = [{ text: '🔇 Mute 1h', callback_data: 'mute_60' }]
        if (dashboardUrl?.startsWith('https://')) {
          inlineButtons.unshift({ text: '📊 Dashboard', url: dashboardUrl } as never)
        }

        await sendTGAlert(msg, {
          dedupeKey:      `alert:${audit.marketQuestion.slice(0, 40)}:${urgency}`,
          dedupeWindowMs: 30 * 60 * 1_000,
          extra: {
            reply_markup: { inline_keyboard: [inlineButtons] },
          },
        })

        const txHash = await anchor(
          `assumption-alert:${audit.marketQuestion.slice(0, 40)}`,
          { marketQuestion: audit.marketQuestion, marketPrice: audit.marketPrice, reason },
        )

        if (txHash) {
          botState.lastTxUrl = `https://sepolia.basescan.org/tx/${txHash}`
        }

        return { txHash: txHash ?? undefined, reason }
      },

      async record_only(args) {
        console.log(`[alert-anomaly] record_only: ${args.note as string}`)
        return { reason: args.note as string }
      },
    },
  })
}
