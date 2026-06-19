'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  AlertCircle, Info, CheckCircle2, ExternalLink,
  Copy, RefreshCw, BrainCircuit, TrendingUp, Bell, Clock,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricePoint    { probability: number; timestamp: number }
interface SubMarketLink { question: string; probability: number; conditionId: string; gap: number }
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
interface SwarmDecision {
  timestamp:        number
  opinions:         { name: string; probability: number; confidence: number; reasoning: string }[]
  aggregate:        number
  kellyFraction:    number
  farcasterCastHash: string | null
  txHash:           string | null
}
interface SnapshotData {
  market:           { question: string; conditionId: string; probability: number } | null
  snapshots:        PricePoint[]
  assumptionAudits: AssumptionAudit[]
  swarmDecisions:   SwarmDecision[]
  lastUpdated:      number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? ''
const BASESCAN_BASE    = 'https://sepolia.basescan.org'

const FRAGILITY_BADGE: Record<string, string> = {
  high:   'border border-red-800 bg-red-950 text-red-400',
  medium: 'border border-yellow-800 bg-yellow-950 text-yellow-400',
  low:    'border border-green-800 bg-green-950 text-green-400',
}
const FRAGILITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-green-500',
}
const FRAGILITY_ICON: Record<string, React.ReactNode> = {
  high:   <AlertCircle className="w-3 h-3" />,
  medium: <Info        className="w-3 h-3" />,
  low:    <CheckCircle2 className="w-3 h-3" />,
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const d = Date.now() - ts
  if (d < 60_000)  return `${Math.floor(d / 1_000)}s ago`
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  return `${Math.floor(d / 3_600_000)}h ago`
}

function shortAddr(addr: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—'
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
      className="ml-1 text-gray-600 hover:text-gray-300 transition"
      title="Copy"
    >
      <Copy className="w-3 h-3 inline" />
      {copied && <span className="ml-1 text-xs text-green-400">✓</span>}
    </button>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: {
  icon:  React.ReactNode
  label: string
  value: string | number
  sub?:  string
}) {
  return (
    <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/60 flex flex-col gap-1">
      <div className="text-gray-500 flex items-center gap-1.5 text-xs">{icon}{label}</div>
      <div className="text-3xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

// ── Assumption card ────────────────────────────────────────────────────────────

function AssumptionCard({ a, parentPrice }: { a: RankedAssumption; parentPrice: number }) {
  return (
    <div className={`border rounded-xl p-4 space-y-2 ${FRAGILITY_BADGE[a.fragility]}`}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-xs font-mono text-gray-600 mt-0.5">#{a.rank}</span>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${FRAGILITY_DOT[a.fragility]}`} />
            <span className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wide ${FRAGILITY_BADGE[a.fragility].split(' ').at(-1)}`}>
              {FRAGILITY_ICON[a.fragility]}{a.fragility}
            </span>
            <span className="text-xs text-gray-600">·  {a.sources.join(', ')}</span>
          </div>
          <p className="text-sm text-gray-100 leading-snug">{a.assumption}</p>
        </div>
      </div>
      <div className="pl-5 space-y-0.5">
        <div className="text-xs text-gray-400">
          <span className="text-gray-600">Breaking event  </span>{a.breakingEvent}
        </div>
        <div className="text-xs text-gray-400">
          <span className="text-gray-600">When  </span>{a.timeToBreak}
        </div>
      </div>
      {a.subMarket && (
        <div className="pl-5 mt-2 border border-gray-700 rounded-lg p-3 space-y-1">
          <div className="text-xs text-gray-500">└─ Sub-market</div>
          <p className="text-xs text-gray-400 line-clamp-2">{a.subMarket.question}</p>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-gray-600">parent <span className="text-indigo-300 font-bold">{(parentPrice * 100).toFixed(1)}%</span></span>
            <span className="text-gray-600">sub    <span className="text-blue-300 font-bold">{(a.subMarket.probability * 100).toFixed(1)}%</span></span>
            {Math.abs(a.subMarket.gap) > 0.02 && (
              <span className={`px-2 py-0.5 rounded font-bold ${a.subMarket.gap > 0 ? 'bg-orange-900 text-orange-300' : 'bg-blue-900 text-blue-300'}`}>
                GAP {a.subMarket.gap > 0 ? '+' : ''}{(a.subMarket.gap * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Decision row ───────────────────────────────────────────────────────────────

function DecisionRow({ d, index }: { d: SwarmDecision; index: number }) {
  const fragilities = d.opinions.map(o => {
    const m = o.reasoning.match(/^\[(high|medium|low)\]/)
    return m?.[1] ?? 'low'
  })
  const dominant = fragilities.includes('high') ? 'high'
    : fragilities.includes('medium') ? 'medium' : 'low'

  return (
    <tr className="border-t border-gray-800 hover:bg-gray-900/60 transition">
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${FRAGILITY_BADGE[dominant]}`}>
          {FRAGILITY_ICON[dominant]}{dominant}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {d.opinions.length} persona{d.opinions.length !== 1 ? 's' : ''}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-indigo-300">
        {(d.aggregate * 100).toFixed(1)}%
      </td>
      <td className="px-4 py-3 text-xs">
        {d.txHash ? (
          <a
            href={`${BASESCAN_BASE}/tx/${d.txHash}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
          >
            {d.txHash.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data,    setData]    = useState<SnapshotData | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastOk,  setLastOk]  = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/snapshot.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json() as SnapshotData)
      setError(null)
      setLastOk(new Date())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => { void refresh() }, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  if (loading) return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
      </div>
    </main>
  )

  if (!data && error) return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="border border-red-900 bg-red-950/40 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> Failed to load snapshot: {error}
      </div>
    </main>
  )

  if (!data) return null

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalDecisions   = data.swarmDecisions?.length ?? 0
  const totalAudits      = data.assumptionAudits?.length ?? 0
  const highFragilityCount = data.assumptionAudits?.filter(
    a => a.assumptions[0]?.fragility === 'high'
  ).length ?? 0
  const latestAudit      = data.assumptionAudits?.[0] ?? null
  const lastTx           = data.swarmDecisions?.find(d => d.txHash)?.txHash ?? null
  const marketPct        = data.market
    ? (data.market.probability * 100).toFixed(1)
    : latestAudit
      ? (latestAudit.marketPrice * 100).toFixed(1)
      : '—'

  const chartData = data.snapshots.map(s => ({
    time:        new Date(s.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    probability: Math.round(s.probability * 10000) / 100,
  }))

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

      {/* ── Error banner ── */}
      {error && (
        <div className="border border-yellow-900 bg-yellow-950/40 rounded-lg px-4 py-2 text-yellow-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-3 h-3" /> RPC/fetch issue — showing last successful data. ({error})
        </div>
      )}

      {/* ── Header ── */}
      <section className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white leading-snug">
            {data.market?.question ?? latestAudit?.marketQuestion ?? 'Monitoring…'}
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Last updated: {data.lastUpdated ? relativeTime(data.lastUpdated) : '—'}
            {lastOk && <> · fetched {lastOk.toLocaleTimeString()}</>}
          </p>
        </div>

        {/* Contract badge */}
        {CONTRACT_ADDRESS && (
          <div className="shrink-0 flex items-center gap-2 border border-gray-700 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-gray-500">Contract</span>
            <span className="font-mono text-gray-300">{shortAddr(CONTRACT_ADDRESS)}</span>
            <CopyBtn text={CONTRACT_ADDRESS} />
            <a
              href={`${BASESCAN_BASE}/address/${CONTRACT_ADDRESS}`}
              target="_blank" rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </section>

      {/* ── Differentiation highlight ── */}
      <section className="border border-indigo-800 bg-indigo-950/40 rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold mb-1">
          <BrainCircuit className="w-4 h-4" /> Differentiation
        </div>
        <p className="text-sm text-indigo-100">
          Every prediction market is a hidden bet on a set of assumptions —<br />
          <span className="font-bold">Faultline makes them visible, ranked, and priced.</span>
        </p>
        <p className="text-xs text-indigo-400 mt-1.5">
          3 anti-anchored AI personas reason independently (without seeing market price), surface fragile assumptions, then search live Polymarket sub-markets to expose mispricing gaps.
        </p>
      </section>

      {/* ── 4 stat cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BrainCircuit className="w-3.5 h-3.5" />}
          label="Total Decisions"
          value={totalDecisions}
          sub={`${totalAudits} audits`}
        />
        <StatCard
          icon={<AlertCircle className="w-3.5 h-3.5" />}
          label="High Fragility"
          value={highFragilityCount}
          sub="audits with high-risk assumption #1"
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Last Update"
          value={data.lastUpdated ? relativeTime(data.lastUpdated) : '—'}
          sub={data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : ''}
        />
        <StatCard
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Market Price (YES)"
          value={`${marketPct}%`}
          sub={data.market ? data.market.question.slice(0, 30) + '…' : ''}
        />
      </section>

      {/* ── Price chart ── */}
      <section className="border border-gray-800 rounded-xl bg-gray-900/60 p-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          YES Probability — all snapshots
        </h2>
        {chartData.length === 0 ? (
          <p className="text-gray-600 text-sm">No data yet — worker polls every 60s</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis
                domain={[0, Math.max(2, Math.ceil((data.market?.probability ?? 0.01) * 100 * 1.5))]}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, 'YES']}
              />
              <Line
                type="monotone" dataKey="probability"
                stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ── Decision timeline ── */}
      <section className="border border-gray-800 rounded-xl bg-gray-900/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Decision Timeline (last {Math.min(totalDecisions, 10)})
          </h2>
          <Bell className="w-3.5 h-3.5 text-gray-600" />
        </div>
        {totalDecisions === 0 ? (
          <p className="px-6 py-4 text-gray-600 text-sm">No decisions yet — worker running…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-gray-600 uppercase tracking-wide">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Fragility</th>
                  <th className="px-4 py-2">Personas</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">On-chain TX</th>
                </tr>
              </thead>
              <tbody>
                {data.swarmDecisions.slice(0, 10).map((d, i) => (
                  <DecisionRow key={d.timestamp} d={d} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Latest assumption audit ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Latest Assumption Audit
        </h2>
        {!latestAudit ? (
          <p className="text-gray-600 text-sm">No audit yet — worker running…</p>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-gray-600">
              {relativeTime(latestAudit.timestamp)}
              {' · '}
              <span className="font-mono">{(latestAudit.marketPrice * 100).toFixed(2)}% market price</span>
            </div>
            {latestAudit.assumptions.map(a => (
              <AssumptionCard key={a.rank} a={a} parentPrice={latestAudit.marketPrice} />
            ))}
          </div>
        )}
      </section>

      {/* ── On-chain record ── */}
      {lastTx && (
        <section className="border border-gray-800 rounded-xl bg-gray-900/60 p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            On-chain Record
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-gray-400">Latest anchor TX:</span>
            <a
              href={`${BASESCAN_BASE}/tx/${lastTx}`}
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              {lastTx.slice(0, 16)}… <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {CONTRACT_ADDRESS && (
            <div className="mt-2 flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-gray-400">SnapshotRegistry:</span>
              <a
                href={`${BASESCAN_BASE}/address/${CONTRACT_ADDRESS}#events`}
                target="_blank" rel="noopener noreferrer"
                className="font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {shortAddr(CONTRACT_ADDRESS)} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </section>
      )}

      {/* ── Audit history (compact) ── */}
      {data.assumptionAudits.length > 1 && (
        <section className="border border-gray-800 rounded-xl bg-gray-900/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Audit History ({data.assumptionAudits.length} runs)
            </h2>
          </div>
          <div className="divide-y divide-gray-800">
            {data.assumptionAudits.slice(0, 5).map(audit => (
              <div key={audit.timestamp} className="px-6 py-3 flex items-start gap-4">
                <span className="shrink-0 text-xs text-gray-600 w-14">
                  {relativeTime(audit.timestamp)}
                </span>
                <div className="flex-1 space-y-1">
                  {audit.assumptions.slice(0, 1).map(a => (
                    <div key={a.rank} className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${FRAGILITY_BADGE[a.fragility]}`}>
                        {FRAGILITY_ICON[a.fragility]}{a.fragility}
                      </span>
                      <span className="text-xs text-gray-400 line-clamp-1">{a.assumption.slice(0, 90)}…</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}
