import Link from 'next/link'

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-bold mb-2">Faultline</h1>
      <p className="text-indigo-400 text-sm font-semibold mb-4 uppercase tracking-widest">
        Assumption Auditor for Prediction Markets
      </p>
      <p className="text-gray-400 text-lg mb-8">
        Three anti-anchored AI personas surface the fragile assumptions
        hidden inside a Polymarket consensus — ranked by how easily each
        breaks, with existing sub-markets surfaced to show the price GAP.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          {
            label: 'Anti-Anchoring',
            desc:  'Personas reason before seeing market price — eliminating anchoring bias from the start',
          },
          {
            label: 'Assumption Ranking',
            desc:  'Output is what the market is implicitly betting on, ranked from most to least fragile',
          },
          {
            label: 'Sub-Market GAP',
            desc:  'Finds live Polymarket markets pricing each assumption directly and shows the spread',
          },
        ].map(card => (
          <div key={card.label} className="border border-gray-800 rounded-lg p-4">
            <div className="text-sm font-semibold text-indigo-400 mb-1">{card.label}</div>
            <div className="text-xs text-gray-500">{card.desc}</div>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard"
        className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition"
      >
        Open Dashboard →
      </Link>
    </main>
  )
}
