'use client'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

interface ServerSummary {
  id:                 string
  name:               string
  last_seen:          string | null
  heartbeat_age_sec:  number | null
  cpu_pct:            number | null
  ram_pct:            number | null
  disk_pct:           number | null
  docker_count:       number | null
  recorded_at:        string | null
  open_alerts:        number
}

interface MetricPoint {
  cpu_pct:     number | null
  ram_pct:     number | null
  disk_pct:    number | null
  recorded_at: string
}

function serverStatus(age: number | null) {
  if (age == null) return 'offline'
  if (age <= 90)  return 'online'
  if (age <= 300) return 'warning'
  return 'offline'
}

function MiniBar({ value, warn = 80, crit = 90 }: { value: number | null; warn?: number; crit?: number }) {
  if (value == null) return <span className="text-slate-700 text-xs">—</span>
  const color = value >= crit ? 'bg-red-500' : value >= warn ? 'bg-yellow-500' : 'bg-green-500'
  const textColor = value >= crit ? 'text-red-400' : value >= warn ? 'text-yellow-400' : 'text-slate-300'
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 bg-sp-hover rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums w-8 text-right ${textColor}`}>{value.toFixed(0)}%</span>
    </div>
  )
}

function Sparkline({ points, key: metric }: { points: MetricPoint[]; key: keyof MetricPoint }) {
  if (!points.length) return <div className="w-24 h-8 bg-sp-hover rounded opacity-30" />
  const vals = points.map(p => (p[metric] as number | null) ?? 0)
  const max  = Math.max(...vals, 1)
  const w = 96; const h = 32
  const step = w / Math.max(vals.length - 1, 1)
  const pts = vals.map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`).join(' ')
  const last = vals[vals.length - 1]
  const color = last >= 90 ? '#f87171' : last >= 80 ? '#facc15' : '#4ade80'
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"
        points={pts} opacity="0.8" />
    </svg>
  )
}

export default function Monitoring() {
  const [servers,  setServers]  = useState<ServerSummary[]>([])
  const [metrics,  setMetrics]  = useState<Record<string, MetricPoint[]>>({})
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const loadSummary = async () => {
    const r = await api.get('/api/monitoring/summary')
    if (r.ok) {
      const { servers: sv } = await r.json()
      setServers(sv)
    }
    setLoading(false)
  }

  const loadMetrics = async (serverId: string) => {
    const r = await api.get(`/api/servers/${serverId}/metrics?limit=60`)
    if (r.ok) {
      const { metrics: m } = await r.json()
      setMetrics(prev => ({ ...prev, [serverId]: m }))
    }
  }

  useEffect(() => {
    loadSummary()
    const t = setInterval(loadSummary, 30_000)
    return () => clearInterval(t)
  }, [])

  const toggleExpand = (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!metrics[id]) loadMetrics(id)
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoring</h1>
          <p className="text-slate-500 text-sm mt-0.5">Live server metrics</p>
        </div>
        <span className="text-[10px] text-slate-700 font-mono">polls every 30s</span>
      </div>

      {loading ? (
        <div className="sp-card text-center text-slate-500 py-10">Loading…</div>
      ) : servers.length === 0 ? (
        <div className="sp-card text-center py-12 text-slate-600 text-sm">No servers registered yet.</div>
      ) : (
        <div className="space-y-3">
          {servers.map(s => {
            const st     = serverStatus(s.heartbeat_age_sec)
            const pts    = metrics[s.id] || []
            const isOpen = expanded === s.id

            return (
              <div key={s.id} className="sp-card">
                {/* Summary row */}
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleExpand(s.id)}>
                  {/* Status dot */}
                  <span className={`relative flex h-2.5 w-2.5 shrink-0 ${
                    st === 'online'  ? '' :
                    st === 'warning' ? 'opacity-80' : 'opacity-60'
                  }`}>
                    {st === 'online' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
                    )}
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      st === 'online' ? 'bg-green-400' :
                      st === 'warning' ? 'bg-yellow-400' : 'bg-red-500'
                    }`} />
                  </span>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{s.name}</p>
                    <p className="text-[11px] text-slate-600">
                      {s.last_seen
                        ? `last seen ${new Date(s.last_seen).toLocaleTimeString()}`
                        : 'never seen'}
                    </p>
                  </div>

                  {/* Alerts */}
                  {s.open_alerts > 0 && (
                    <Link to="/alerts"
                      onClick={e => e.stopPropagation()}
                      className="px-2 py-0.5 rounded text-[11px] font-bold text-red-400 bg-red-500/10 ring-1 ring-red-500/30">
                      {s.open_alerts} alert{s.open_alerts > 1 ? 's' : ''}
                    </Link>
                  )}

                  {/* Mini bars */}
                  <div className="hidden md:flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-600 mb-1">CPU</p>
                      <MiniBar value={s.cpu_pct} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-600 mb-1">RAM</p>
                      <MiniBar value={s.ram_pct} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-600 mb-1">Disk</p>
                      <MiniBar value={s.disk_pct} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-600 mb-1">Containers</p>
                      <p className="text-xs text-slate-400 tabular-nums">{s.docker_count ?? '—'}</p>
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <span className={`text-slate-600 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </div>

                {/* Expanded: sparklines */}
                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-sp-border">
                    {pts.length === 0 ? (
                      <p className="text-xs text-slate-600 text-center py-4">No metric history yet</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-6">
                        {(['cpu_pct', 'ram_pct', 'disk_pct'] as const).map(m => {
                          const last = pts[pts.length - 1]?.[m] as number | null
                          return (
                            <div key={m} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider">
                                  {m.replace('_pct', '').toUpperCase()}
                                </p>
                                {last != null && (
                                  <p className={`text-xs font-mono font-bold ${
                                    last >= 90 ? 'text-red-400' : last >= 80 ? 'text-yellow-400' : 'text-green-400'
                                  }`}>{last.toFixed(1)}%</p>
                                )}
                              </div>
                              <Sparkline points={pts} key={m} />
                              <p className="text-[10px] text-slate-700">{pts.length} samples</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex justify-end mt-3">
                      <Link to={`/servers/${s.id}`}
                        className="text-xs text-slate-500 hover:text-slate-200 transition-colors">
                        Server detail →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
