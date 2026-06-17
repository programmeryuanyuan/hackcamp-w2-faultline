// Must run before any import reads process.env
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config()

import { WorldModel }           from './world-model'
import { runPersonas }          from './personas'
import { aggregate }            from './aggregator'
import { enrichWithSubMarkets } from './assumption-search'
import { castDecision }         from './farcaster'
import { recordOnChain }        from './registry'
import { notify }               from './notify'

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 60_000)

const worldModel = new WorldModel()

async function runCycle(): Promise<void> {
  console.log('\n── cycle start', new Date().toISOString(), '──')

  await worldModel.update()

  const state   = worldModel.getState()
  const market  = state.market
  if (!market) return  // don't overwrite snapshot with empty state on failed fetch

  worldModel.writeSnapshot()

  // personas reason WITHOUT seeing market price (anti-anchoring)
  const opinions = await runPersonas(state)
  if (opinions.length === 0) return

  const audit = aggregate(opinions, market.question, market.probability)
  if (!audit) return

  console.log(`[index] audit complete — ${audit.assumptions.length} assumptions`)
  audit.assumptions.forEach(a =>
    console.log(`  [${a.rank}] [${a.fragility}] ${a.assumption.slice(0, 80)}`)
  )

  // G: search for existing sub-markets and attach prices (exclude parent by conditionId + question)
  await enrichWithSubMarkets(audit.assumptions, market.probability, market.conditionId, market.question)

  // store audit for dashboard
  worldModel.addAudit(audit)

  // record on-chain
  const auditHash = Buffer.from(JSON.stringify(audit)).toString('base64').slice(0, 32)
  await recordOnChain(
    { probability: market.probability, kellyFraction: 0, edge: 0, opinions: [] },
    market.question,
    auditHash,
    '',
  )

  // Farcaster cast
  await castDecision(
    { probability: market.probability, kellyFraction: 0, edge: 0, opinions: [] },
    market.question,
  )

  // snapshot for dashboard
  worldModel.addDecision({
    timestamp:         Date.now(),
    opinions:          opinions.map(o => ({
      name:       o.name,
      probability: 0,
      confidence:  0,
      reasoning:  `[${o.fragility}] ${o.assumption} | ${o.breakingEvent}`,
    })),
    aggregate:         market.probability,
    kellyFraction:     0,
    farcasterCastHash: null,
    txHash:            null,
  })
  worldModel.writeSnapshot()

  await notify(
    `Audit: ${audit.assumptions[0]?.assumption.slice(0, 80)} ` +
    `[${audit.assumptions[0]?.fragility}]`
  )
}

async function main(): Promise<void> {
  console.log('Faultline starting…')
  console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`)

  await runCycle()
  setInterval(runCycle, POLL_INTERVAL_MS)
}

main().catch(err => {
  console.error('[fatal]', err)
  process.exit(1)
})
