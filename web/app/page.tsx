import Link from 'next/link'
import {
  BrainCircuit, ListOrdered, Search, ArrowRight, ExternalLink,
} from 'lucide-react'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? ''
const BASESCAN_BASE    = 'https://sepolia.basescan.org'

const TECH_TAGS = [
  'Polymarket',
  'Base Sepolia',
  'OpenAI',
  'Farcaster',
  'Telegram Bot',
  'Next.js',
  'viem',
]

const HOW_IT_WORKS = [
  {
    icon: <BrainCircuit className="w-6 h-6 text-indigo-400" />,
    step: '01',
    title: 'Anti-anchored AI audit',
    desc:  '3 AI personas reason independently — without seeing the market price — to surface assumptions the market implicitly relies on.',
  },
  {
    icon: <ListOrdered className="w-6 h-6 text-indigo-400" />,
    step: '02',
    title: 'Ranked by fragility',
    desc:  'Assumptions are deduped, aggregated across personas, and ranked by how easily each one breaks and when.',
  },
  {
    icon: <Search className="w-6 h-6 text-indigo-400" />,
    step: '03',
    title: 'Sub-market GAP discovery',
    desc:  'Live Polymarket sub-markets pricing each assumption directly are surfaced, revealing the spread between belief layers.',
  },
]

export default function HomePage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-20 space-y-20">

      {/* ── Hero ── */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 border border-indigo-800 bg-indigo-950/40 rounded-full px-3 py-1 text-xs text-indigo-400 font-medium">
          <BrainCircuit className="w-3.5 h-3.5" /> AI Data × Web3 · Base Sepolia
        </div>

        <h1 className="text-5xl font-bold text-white leading-tight">
          Fault<span className="text-indigo-400">line</span>
        </h1>

        <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
          Every prediction market is a hidden bet on a set of assumptions —<br />
          <span className="text-white font-semibold">Faultline makes them visible, ranked, and priced.</span>
        </p>

        <p className="text-gray-500 text-sm max-w-xl">
          An AI agent audits Polymarket consensus using three anti-anchored personas,
          surfaces the fragile assumptions hidden in market prices, finds existing
          sub-markets to expose mispricing, and anchors evidence on-chain.
        </p>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition"
          >
            Open Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          {CONTRACT_ADDRESS && (
            <a
              href={`${BASESCAN_BASE}/address/${CONTRACT_ADDRESS}#events`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition"
            >
              On-chain log <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </section>

      {/* ── How it works ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-8">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(item => (
            <div key={item.step} className="border border-gray-800 rounded-xl p-6 space-y-3 bg-gray-900/40">
              <div className="flex items-center gap-3">
                {item.icon}
                <span className="text-xs font-mono text-gray-600">{item.step}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Differentiation callout ── */}
      <section className="border border-indigo-800 bg-indigo-950/30 rounded-xl px-6 py-5 space-y-2">
        <div className="text-xs text-indigo-500 font-semibold uppercase tracking-widest">
          The core insight
        </div>
        <p className="text-base text-indigo-100">
          Most forecasting tools anchor on the market price first. Faultline reverses that —
          AI reasons <em>before</em> seeing the price, then finds where market consensus is
          silently betting on assumptions that can break.
        </p>
      </section>

      {/* ── Tech tags ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-4">
          Built with
        </h2>
        <div className="flex flex-wrap gap-2">
          {TECH_TAGS.map(tag => (
            <span
              key={tag}
              className="border border-gray-700 bg-gray-900 text-gray-400 text-xs px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

    </main>
  )
}
