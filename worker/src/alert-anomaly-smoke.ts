require('dotenv').config()

import { recordPrice, alertOnAnomaly } from './alert-anomaly'

// 10 rounds: stable → spike at round 5 → cooldown → drop at round 9
const PRICES = [0.620, 0.622, 0.619, 0.621, 0.620, 0.756, 0.751, 0.748, 0.743, 0.621]
const TOKEN_ID = 'smoke-token-42'

async function main() {
  console.log('── alert-anomaly-smoke: 10 rounds ──\n')

  for (let i = 0; i < PRICES.length; i++) {
    const price = PRICES[i]
    console.log(`\n── round ${i + 1}/10  price=${price} ──`)
    recordPrice(price)
    await alertOnAnomaly(TOKEN_ID, price)
  }

  console.log('\n── done ──')
}

main().catch(err => {
  console.error('[smoke] fatal:', err.message)
  process.exit(1)
})
