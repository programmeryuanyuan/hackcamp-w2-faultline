'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface PricePoint { probability: number; timestamp: number }

interface SubMarketLink {
  question:    string
  probability: number
  conditionId: string
  gap:         number
}

interface RankedAssumption {
  rank:          number
  fragility:     'high' | 'medium' | 'low'
  assumption:    string
  breakingEvent: string
  timeToBreak:   string
  sources:       string[]
  subMarket:     SubMarketLink | null
}

interface AssumptionAudit {
  timestamp:      number
  marketQuestion: string
  marketPrice:    number
  assumptions:    RankedAssumption[]
}

interface SnapshotData {
  market:           { question: string; conditionId: string; probability: number } | null
  snapshots:        PricePoint[]
  assumptionAudits: AssumptionAudit[]
  lastUpdated:      number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const FRAGILITY_COLOR = {
  high:   'text-red-400 border-red-800 bg-red-950',
  medium: 'text-yellow-400 border-yellow-800 bg-yellow-950',
  low:    'text-green-400 border-green-800 bg-green-950',
}

const FRAGILITY_DOT = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-green-500',
}

function toChartData(snapshots: PricePoint[]) {
  return snapshots
    .filter(s => s.timestamp > Date.now() - 3_600_000)
    .map(s => ({
      time: new Date(s.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false,
      }),
      probability: Math.round(s.probability * 1000) / 10,
    }))
}

// ── Sub-market card ──────────────────────────────────────────────────────────

function SubMarketCard({ sub, parentPrice }: { sub: SubMarketLink; parentPrice: number }) {
  const gapPct   = (sub.gap * 100).toFixed(1)
  const subPct   = (sub.probability * 100).toFixed(1)
  const parentPct = (parentPrice * 100).toFixed(1)
  const hasGap   = Math.abs(sub.gap) > 0.02

  return (
    <div className="mt-3 border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="text-gray-600">└─</span>
        <span className="font-medium text-gray-300">Sub-market</span>
      </div>
      <p className="text-xs text-gray-400 line-clamp-2">{sub.question}</p>
      <div className="flex items-center gap-4 text-xs font-mono">
        <div>
          <span className="text-gray-600">parent  </span>
          <span className="text-indigo-300 font-bold">{parentPct}%</span>
        </div>
        <div>
          <span className="text-gray-600">sub     </span>
          <span className="text-blue-300 font-bold">{subPct}%</span>
        </div>
        {hasGap && (
          <div className={`px-2 py-0.5 rounded text-xs font-bold ${
            sub.gap > 0 ? 'bg-orange-900 text-orange-300' : 'bg-blue-900 text-blue-300'
          }`}>
            GAP {sub.gap > 0 ? '+' : ''}{gapPct}%
          </div>
        )}
      </div>
    </div>
  )
}

// ── Assumption card ──────────────────────────────────────────────────────────

function AssumptionCard({ a, parentPrice }: { a: RankedAssumption; parentPrice: number }) {
  return (
    <div className={`border rounded-lg p-4 space-y-2 ${FRAGILITY_COLOR[a.fragility]}`}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-xs font-mono text-gray-500 mt-0.5">#{a.rank}</span>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${FRAGILITY_DOT[a.fragility]}`} />
            <span className={`text-xs font-bold uppercase tracking-wide ${FRAGILITY_COLOR[a.fragility].split(' ')[0]}`}>
              {a.fragility}
            </span>
            <span className="text-xs text-gray-600">·  {a.sources.join(', ')}</span>
          </div>
          <p className="text-sm text-gray-100 leading-snug">{a.assumption}</p>
        </div>
      </div>

      <div className="pl-5 space-y-1">
        <div className="text-xs text-gray-400">
          <span className="text-gray-600">Breaking event  </span>
          {a.breakingEvent}
        </div>
        <div className="text-xs text-gray-400">
          <span className="text-gray-600">When  </span>
          {a.timeToBreak}
        </div>
      </div>

      {a.subMarket && (
        <div className="pl-5">
          <SubMarketCard sub={a.subMarket} parentPrice={parentPrice} />
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data,    setData]    = useState<SnapshotData | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const res = await fetch(`/snapshot.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json() as SnapshotData)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <p className="p-8 text-gray-500">Loading…</p>
  if (error)   return <p className="p-8 text-red-400">Error: {error}</p>
  if (!data)   return null

  const chartData   = toChartData(data.snapshots)
  const latestAudit = data.assumptionAudits?.[0] ?? null
  const marketPct   = data.market
    ? (data.market.probability * 100).toFixed(1)
    : latestAudit
      ? (latestAudit.marketPrice * 100).toFixed(1)
      : '—'

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">

      {/* Header */}
      <section>
        <div className="flex items-start gap-4 mb-1">
          <h2 className="text-xl font-bold leading-snug flex-1">
            {data.market?.question ?? latestAudit?.marketQuestion ?? 'Waiting for market data…'}
          </h2>
          <span className="shrink-0 text-3xl font-mono font-bold text-indigo-400">
            {marketPct}%
          </span>
        </div>
        <p className="text-xs text-gray-600">
          Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : '—'}
          {data.market && ` · ${data.market.conditionId.slice(0, 12)}…`}
        </p>
      </section>

      {/* Price chart */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          YES Probability — last 1h
        </h3>
        {chartData.length === 0 ? (
          <p className="text-gray-600 text-sm">No data yet — worker polls every 60s</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time"     tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis domain={[0, 100]}  tick={{ fill: '#6b7280', fontSize: 11 }}
                     tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, 'YES']}
              />
              <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="probability"
                    stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Assumption audits */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Assumption Audit
        </h3>

        {!latestAudit ? (
          <p className="text-gray-600 text-sm">No audit yet — worker running…</p>
        ) : (
          <div className="space-y-6">
            {data.assumptionAudits.slice(0, 3).map(audit => (
              <div key={audit.timestamp} className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>{new Date(audit.timestamp).toLocaleTimeString()}</span>
                  <span>·</span>
                  <span className="font-mono">{(audit.marketPrice * 100).toFixed(1)}% market</span>
                </div>

                <div className="space-y-2">
                  {audit.assumptions.map(a => (
                    <AssumptionCard
                      key={a.rank}
                      a={a}
                      parentPrice={audit.marketPrice}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  )
}
