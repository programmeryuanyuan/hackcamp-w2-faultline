import { getLlmClient, getLlmModel } from './llm'
import { withRetry } from './utils'
import type { WorldState } from './world-model'

export interface PersonaOpinion {
  name:          string
  assumption:    string  // the core assumption the market is betting on
  fragility:     'high' | 'medium' | 'low'
  breakingEvent: string  // specific event that would invalidate the assumption
  timeToBreak:   string  // when that event could occur
  reasoning:     string
}

const PERSONAS = [
  {
    name: 'Fundamentals Analyst',
    instruction: `You are a fundamentals analyst auditing a prediction market.

Your task: identify the single most load-bearing DATA assumption this market's consensus requires to be true.
- Must reference a specific data release, metric, or measurable threshold
- Must include the exact date that assumption will be tested
- Do NOT output a probability. Only output the assumption and its fragility.
- Bad example: "no major unexpected events occur"
- Good example: "August CPI (published Sept 11) must not rebound above 3.2%"`,
  },
  {
    name: 'Event Horizon',
    instruction: `You are a timeline analyst auditing a prediction market.

Your task: identify the earliest upcoming binary event that could shatter the current consensus.
- List all key dates between now and resolution
- Pick the EARLIEST one that is truly binary (either/or outcome)
- Explain precisely what each outcome means for the market
- Do NOT output a probability. Only output the assumption and its fragility.`,
  },
  {
    name: 'Contrarian',
    instruction: `You are a silent assumption hunter auditing a prediction market.

Your task: find the assumption nobody is saying out loud but everyone is betting on.
- It should NOT appear in any news headline or market description
- Use this test: "if this assumption silently disappeared tomorrow, would the market price collapse?"
- The assumption should be structural, not event-based
- Do NOT output a probability. Only output the assumption and its fragility.`,
  },
]

const TOOL = {
  type: 'function' as const,
  function: {
    name: 'report_assumption',
    description: 'Report the single most fragile assumption underlying this market',
    parameters: {
      type: 'object',
      properties: {
        assumption:    { type: 'string', description: 'One sentence: what must be true for consensus to hold' },
        fragility:     { type: 'string', enum: ['high', 'medium', 'low'] },
        breakingEvent: { type: 'string', description: 'Specific event or data release that would invalidate it' },
        timeToBreak:   { type: 'string', description: 'When this event could occur (e.g. "Sept 11, 7 days before resolution")' },
        reasoning:     { type: 'string', description: 'One paragraph explaining your reasoning' },
      },
      required: ['assumption', 'fragility', 'breakingEvent', 'timeToBreak', 'reasoning'],
    },
  },
}

function buildPrompt(market: NonNullable<WorldState['market']>): string {
  return `Market: "${market.question}"
Resolution criteria: ${market.description || '(not provided)'}
Resolution date: ${market.endDate || '(not provided)'}

IMPORTANT: You do NOT know the current market price. Reason independently.`
}

async function runPersona(
  persona: typeof PERSONAS[number],
  state: WorldState,
): Promise<PersonaOpinion | null> {
  if (!state.market) return null

  const client = getLlmClient()
  const model  = getLlmModel()
  const market = state.market

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: persona.instruction },
        { role: 'user',   content: buildPrompt(market) },
      ],
      tools:       [TOOL],
      tool_choice: { type: 'function', function: { name: 'report_assumption' } },
      temperature: 0.3,
    })

    const call = response.choices[0]?.message?.tool_calls?.[0]
    if (!call) throw new Error('no tool_call in response')

    const args = JSON.parse(call.function.arguments) as {
      assumption: string
      fragility: 'high' | 'medium' | 'low'
      breakingEvent: string
      timeToBreak: string
      reasoning: string
    }

    return { name: persona.name, ...args }
  }, `personas/${persona.name}`)
}

export async function runPersonas(state: WorldState): Promise<PersonaOpinion[]> {
  if (!state.market) {
    console.log('[personas] no market data — skipping')
    return []
  }

  console.log('[personas] running 3 persona agents (anti-anchored)…')

  const results = await Promise.all(PERSONAS.map(p => runPersona(p, state)))
  const opinions = results.filter((r): r is PersonaOpinion => r !== null)

  opinions.forEach(o => {
    console.log(`[personas] ${o.name}: [${o.fragility}] ${o.assumption.slice(0, 80)}…`)
  })

  return opinions
}
