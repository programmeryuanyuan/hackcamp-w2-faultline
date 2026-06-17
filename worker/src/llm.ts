import OpenAI from 'openai'

let _client: OpenAI | null = null

// Lazy init: env vars are only read on first call, not at module load time.
// This avoids the CJS require-hoisting issue where dotenv hasn't loaded yet.
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

// ── D3: Persona reasoning ────────────────────────────────────────────────────
// TODO D3: implement anti-anchored probability estimate via tool_use
// export async function reasonAsPersona(
//   persona: string,
//   worldState: WorldState
// ): Promise<{ probability: number; confidence: number; reasoning: string }> {
//   const client = getLlmClient()
//   const model  = getLlmModel()
//   // ... tool_use call with structured output
// }
