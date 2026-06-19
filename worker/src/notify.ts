// eslint-disable-next-line @typescript-eslint/no-require-imports
const TelegramBot = require('node-telegram-bot-api')
import { readFileSync } from 'node:fs'
import { resolve }      from 'node:path'

// All env reads are deferred to first call — avoids the TS/CJS hoist problem
// where module-level code runs before require('dotenv').config() in index.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pushBot: any = undefined   // undefined = not yet initialised; null = no token

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPushBot(): any {
  if (_pushBot !== undefined) return _pushBot
  const token = process.env.TG_BOT_TOKEN ?? ''
  if (!token || !process.env.TG_CHAT_ID) {
    console.warn('[telegram] TG_BOT_TOKEN or TG_CHAT_ID missing — alerts will be no-op')
    return (_pushBot = null)
  }
  // request lib auto-reads HTTPS_PROXY env var — no explicit proxy option needed
  return (_pushBot = new TelegramBot(token, { polling: false }))
}

function getChatId(): string {
  return process.env.TG_CHAT_ID ?? ''
}

export const botState = {
  totalDecisions:  0,
  alertsTriggered: 0,
  lastTxUrl:       '',
}

const recentAlerts = new Map<string, number>()
let muteUntil = 0

export function isMuted(): boolean    { return Date.now() < muteUntil }
export function muteAlertsFor(ms: number): void { muteUntil = Date.now() + ms }

export async function sendTGAlert(
  text: string,
  opts: {
    dedupeKey?:      string
    dedupeWindowMs?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?:          Record<string, any>
  } = {},
): Promise<void> {
  const bot = getPushBot()
  if (!bot) { console.log('[telegram-noop]', text.slice(0, 80)); return }
  if (isMuted()) { console.log('[telegram-muted]', text.slice(0, 40)); return }

  if (opts.dedupeKey) {
    const last = recentAlerts.get(opts.dedupeKey)
    const win  = opts.dedupeWindowMs ?? 30 * 60 * 1_000
    if (last && Date.now() - last < win) {
      console.log(`[telegram-dedupe] suppressed: ${opts.dedupeKey}`)
      return
    }
    recentAlerts.set(opts.dedupeKey, Date.now())
  }

  botState.alertsTriggered++
  try {
    await bot.sendMessage(getChatId(), text, { parse_mode: 'Markdown', ...opts.extra })
  } catch (err) {
    console.error('[telegram] sendMessage failed:', (err as Error).message)
  }
}

// Legacy compat
export async function notify(message: string): Promise<void> {
  await sendTGAlert(message)
}

// Call ONCE from main() — polling:true, never call from two processes simultaneously.
export async function setupCommands(): Promise<void> {
  const token = process.env.TG_BOT_TOKEN ?? ''
  if (!token) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bot: any = new TelegramBot(token, { polling: true })

  try {
    await bot.setMyCommands([
      { command: 'start',    description: 'Start the bot' },
      { command: 'status',   description: 'Show monitoring stats since start' },
      { command: 'snapshot', description: 'Get the latest assumption audit' },
      { command: 'mute',     description: 'Mute alerts for 1 hour' },
      { command: 'help',     description: 'Show all commands' },
    ])
  } catch (err) {
    console.warn('[telegram] setMyCommands failed (TG API unreachable?):', (err as Error).message)
  }

  bot.onText(/\/start/, (msg: { chat: { id: number } }) => {
    bot.sendMessage(msg.chat.id,
      '*Faultline* — Assumption Auditor for Prediction Markets\n\n' +
      '_Every prediction market is a hidden bet on a set of assumptions_ — ' +
      'Faultline makes them *visible*, *ranked*, and *priced*.\n\n' +
      'Send /snapshot to see the latest audit, or wait for an alert.',
      { parse_mode: 'Markdown' }
    )
  })

  bot.onText(/\/help/, (msg: { chat: { id: number } }) => {
    bot.sendMessage(msg.chat.id, [
      '*Faultline Bot — Commands*',
      '/status   — stats since process start',
      '/snapshot — latest assumption audit (Top 3)',
      '/mute     — silence alerts for 1 hour',
    ].join('\n'), { parse_mode: 'Markdown' })
  })

  bot.onText(/\/status/, (msg: { chat: { id: number } }) => {
    bot.sendMessage(msg.chat.id, [
      '*📊 Stats (since start)*',
      `• Cycles run: ${botState.totalDecisions}`,
      `• Alerts fired: ${botState.alertsTriggered}`,
      `• Last anchor TX: ${botState.lastTxUrl || '—'}`,
      `• Mute: ${isMuted() ? '🔇 active' : '🔔 off'}`,
    ].join('\n'), { parse_mode: 'Markdown' })
  })

  bot.onText(/\/snapshot/, (msg: { chat: { id: number } }) => {
    let out = 'No snapshot yet.'
    try {
      const raw = JSON.parse(readFileSync(
        resolve(__dirname, '../../web/public/snapshot.json'), 'utf8'
      )) as { audits?: Array<{ marketQuestion: string; marketPrice: number; assumptions: Array<{ rank: number; fragility: string; assumption: string }> }> }
      const audits = raw.audits ?? []
      if (audits.length > 0) {
        const last = audits[audits.length - 1]!
        out = [
          '*📋 Latest Audit*',
          `*Q:* ${last.marketQuestion.slice(0, 80)}`,
          `*Price:* ${(last.marketPrice * 100).toFixed(1)}%`,
          '',
          '*Top Assumptions:*',
          ...last.assumptions.slice(0, 3).map(a =>
            `[${a.rank}] [${a.fragility}] ${a.assumption.slice(0, 60)}`
          ),
        ].join('\n')
      }
    } catch {
      out = botState.lastTxUrl
        ? `Latest anchor: [Basescan](${botState.lastTxUrl})`
        : 'No snapshot yet.'
    }
    bot.sendMessage(msg.chat.id, out, { parse_mode: 'Markdown' })
  })

  bot.onText(/\/mute/, (msg: { chat: { id: number } }) => {
    muteAlertsFor(60 * 60 * 1_000)
    bot.sendMessage(msg.chat.id, '🔇 Alerts muted for 1 hour.')
  })

  bot.on('callback_query', async (query: { id: string; data?: string }) => {
    if (query.data === 'mute_60') {
      muteAlertsFor(60 * 60 * 1_000)
      await bot.answerCallbackQuery(query.id, { text: 'Muted for 1 hour ✅' })
    }
  })

  let lastPollingErrorLog = 0
  bot.on('polling_error', (err: Error) => {
    if (Date.now() - lastPollingErrorLog > 5 * 60 * 1_000) {
      console.warn('[telegram] polling error (suppressing repeats for 5m):', err.message)
      lastPollingErrorLog = Date.now()
    }
  })

  console.log('[telegram] interactive bot ready — listening for /commands')
}
