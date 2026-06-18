import OpenAI from 'openai'
import { issueReceipt }  from './receipt'
import { anchor }        from './registry'

let _client: OpenAI | null = null

// Lazy init so dotenv has already run before first call.
export function getLlmClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey:  process.env.LLM_API_KEY  ?? 'placeholder',
      baseURL: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com',
    })
  }
  return _client
}

export function getLlmModel(): string {
  return process.env.LLM_MODEL ?? 'deepseek-chat'
}

// ── decide() ────────────────────────────────────────────────────────────────

export type HandlerResult = { txHash?: string; reason?: string; [k: string]: unknown }

export interface DecideOptions {
  scenario:     string
  data:         Record<string, unknown>
  history:      unknown[]
  budget:       Record<string, unknown>
  systemPrompt: string
  tools:        OpenAI.Chat.Completions.ChatCompletionTool[]
  handlers:     Record<string, (args: Record<string, unknown>) => Promise<HandlerResult | void>>
}

function buildUserPrompt(
  data: Record<string, unknown>,
  history: unknown[],
  budget: Record<string, unknown>,
): string {
  return [
    '## Current Data',
    JSON.stringify(data, null, 2),
    '',
    '## Recent History',
    JSON.stringify(history, null, 2),
    '',
    '## Budget / Status',
    JSON.stringify(budget, null, 2),
  ].join('\n')
}

function argsSummary(args: Record<string, unknown>): string {
  const entries = Object.entries(args).slice(0, 3)
  if (entries.length === 0) return '—'
  return entries
    .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
    .join(', ')
}

export async function decide(opts: DecideOptions): Promise<void> {
  const { scenario, data, history, budget, systemPrompt, tools, handlers } = opts
  const client = getLlmClient()
  const model  = getLlmModel()
  const t0     = Date.now()

  let action   = 'noop'
  let callArgs: Record<string, unknown> = {}
  let txHash:   string | undefined
  let reason    = ''

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: buildUserPrompt(data, history, budget) },
      ],
      tools,
      tool_choice: 'auto',
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall) {
      action = toolCall.function.name
      try {
        callArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
      } catch {
        callArgs = {}
      }

      const handler = handlers[action]
      if (handler) {
        const result = await handler(callArgs)
        if (result) {
          txHash = result.txHash
          reason = (result.reason as string | undefined) ?? ''
        }
      } else {
        console.warn(`[decide] no handler registered for tool "${action}"`)
      }

      // extract reason from args as fallback (callers often put it there)
      if (!reason && typeof callArgs.reason === 'string') reason = callArgs.reason
    }
  } catch (err) {
    console.warn(`[decide][${scenario}] LLM call failed:`, (err as Error).message)
    action = 'noop'
  }

  const ms = Date.now() - t0

  // structured decision log
  console.log(
    JSON.stringify({
      t:        new Date().toISOString(),
      scenario,
      action,
      ms,
      args:     argsSummary(callArgs),
      ...(txHash ? { txHash } : {}),
    })
  )

  // [支付方向] receipt every round — includes noop and decline
  const receiptId = await issueReceipt(action, reason || '(no reason provided)')
  console.log(`[decide] receipt=${receiptId}`)

  // [数据方向] on-chain anchor only for trigger_alert — skip if handler already anchored (txHash set)
  if (action === 'trigger_alert' && !txHash) {
    const anchorHash = await anchor(`${scenario}:trigger_alert`, { scenario, callArgs })
    if (anchorHash) console.log(`[decide] anchored txHash=${anchorHash}`)
  }
}
