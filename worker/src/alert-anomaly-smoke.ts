require('dotenv').config()

import { alertOnAnomaly } from './alert-anomaly'
import type { AssumptionAudit } from './aggregator'

// Case A: 应触发 — 市场过度自信(0.92) + fragility=high + 3个persona验证
const AUDIT_TRIGGER: AssumptionAudit = {
  marketQuestion: 'Will the Fed cut rates before end of Q3 2025?',
  marketPrice:    0.92,
  assumptions: [
    {
      rank:          1,
      fragility:     'high',
      assumption:    'August CPI must not rebound above 3.2% (published Sept 11)',
      breakingEvent: 'Surprise energy price spike reflected in August CPI data',
      timeToBreak:   'Sept 11, 8 days before resolution',
      sources:       ['Fundamentals Analyst', 'Event Horizon', 'Contrarian'],
      subMarket:     null,
    },
    {
      rank:          2,
      fragility:     'medium',
      assumption:    'No FOMC emergency meeting called before scheduled September date',
      breakingEvent: 'Sudden financial instability triggering emergency session',
      timeToBreak:   'Any time before Sept 18',
      sources:       ['Event Horizon'],
      subMarket:     null,
    },
  ],
}

// Case B: 应静默 — 市场不确定(0.55) + fragility=high 但只有1个persona验证
const AUDIT_QUIET: AssumptionAudit = {
  marketQuestion: 'Will Bitcoin exceed $100k by year end?',
  marketPrice:    0.55,
  assumptions: [
    {
      rank:          1,
      fragility:     'high',
      assumption:    'Institutional inflows must continue at current pace',
      breakingEvent: 'Major ETF outflow event',
      timeToBreak:   'Within 30 days',
      sources:       ['Fundamentals Analyst'],
      subMarket:     null,
    },
  ],
}

async function main() {
  console.log('── alert-anomaly-smoke ──\n')

  console.log('── Case A: overconfident market + high fragility + 3 personas (expect trigger_alert) ──')
  await alertOnAnomaly(AUDIT_TRIGGER)

  console.log('\n── Case B: uncertain market + single persona (expect record_only) ──')
  await alertOnAnomaly(AUDIT_QUIET)

  console.log('\n── done ──')
}

main().catch(err => {
  console.error('[smoke] fatal:', err.message)
  process.exit(1)
})
