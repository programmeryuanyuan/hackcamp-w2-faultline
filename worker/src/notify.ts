// D5 – Telegram push notifications
// TODO: replace console.log stubs with actual TG Bot API calls
// POST https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage

export async function notify(message: string): Promise<void> {
  console.log('[notify] TODO D5 –', message)
}

// D5 – single-message alert with urgency tag; real impl sends TG message
export async function sendTGAlert(message: string, urgency: 'low' | 'medium' | 'high'): Promise<void> {
  console.log(`[notify:tg] [${urgency.toUpperCase()}] ${message}`)
}
