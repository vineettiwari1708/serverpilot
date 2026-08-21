import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Container {
  id:         string
  name:       string
  image:      string
  status:     string
  ports:      string
  updated_at: string
}

interface Command {
  id:           string
  container:    string
  action:       string
  status:       'pending' | 'running' | 'done' | 'error'
  result:       string
  requested_by: string
  created_at:   string
}

interface ServerInfo {
  id:           string
  name:         string
  hostname:     string
  ip:           string | null
  tags:         string[]
  status:       'online' | 'offline' | 'pending'
  last_seen:    string | null
  cpu_pct:      number | null
  ram_pct:      number | null
  disk_pct:     number | null
  docker_count: number | null
}

interface DetailResponse {
  server:     ServerInfo
  containers: Container[]
  commands:   Command[]
}

interface MetricPoint {
  time:     string
  cpu_pct:  number | null
  ram_pct:  number | null
  disk_pct: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRunning(status: string) { return /^up/i.test(status) }

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

type TabKey = 'containers' | 'commands' | 'metrics'

// ── Component ─────────────────────────────────────────────────────────────────

export default function ServerDetail() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const isAdmin   = user?.role === 'admin'

  const [data,      setData]      = useState<DetailResponse | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  usePageTitle(data?.server?.name ?? 'Server')
  const [pending,   setPending]   = useState<Record<string, boolean>>({})
  const [tab,       setTab]       = useState<TabKey>('containers')
  const [metrics,   setMetrics]   = useState<MetricPoint[]>([])
  const [mLoading,  setMLoading]  = useState(false)
  const [token,     setToken]     = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [tagInput,  setTagInput]  = useState('')
  const [tags,      setTags]      = useState<string[]>([])
  const [savingTag, setSavingTag] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/api/servers/${id}`)
      if (!res.ok) { setError('Server not found'); return }
      const d = await res.json() as DetailResponse
      setData(d)
      setTags(d.server.tags ?? [])
      setError('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchMetrics = useCallback(async () => {
    setMLoading(true)
    try {
      const res = await api.get(`/api/servers/${id}/metrics?limit=60`)
      if (!res.ok) return
      const d = await res.json() as { metrics: { cpu_pct: number|null; ram_pct: number|null; disk_pct: number|null; recorded_at: string }[] }
      setMetrics(d.metrics.map(m => ({
        time:     fmtTime(m.recorded_at),
        cpu_pct:  m.cpu_pct,
        ram_pct:  m.ram_pct,
        disk_pct: m.disk_pct,
      })))
    } finally {
      setMLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 15_000)
    return () => clearInterval(t)
  }, [fetchData])

  const fetchToken = async () => {
    const r = await api.get(`/api/servers/${id}/token`)
    if (r.ok) { const d = await r.json(); setToken(d.agent_token) }
  }

  const deleteServer = async () => {
    if (!data) return
    if (!confirm(`Delete "${data.server.name}"?\n\nThis removes all heartbeat data, containers, deployments, backups and alerts. This cannot be undone.`)) return
    setDeleting(true)
    try {
      const r = await api.delete(`/api/servers/${id}`)
      if (r.ok) navigate('/servers', { replace: true })
    } finally { setDeleting(false) }
  }

  useEffect(() => {
    if (tab !== 'metrics') return
    fetchMetrics()
    const t = setInterval(fetchMetrics, 30_000)
    return () => clearInterval(t)
  }, [tab, fetchMetrics])

  const sendAction = async (containerName: string, action: string) => {
    setPending(p => ({ ...p, [containerName]: true }))
    try {
      await api.post(`/api/servers/${id}/containers/${containerName}/action`, { action })
      await fetchData()
    } finally {
      setPending(p => ({ ...p, [containerName]: false }))
    }
  }

  if (loading) return (
    <div className="p-6 text-slate-600 text-sm animate-pulse">Loading…</div>
  )
  if (error || !data) return (
    <div className="p-6 text-red-400 text-sm">{error || 'Unknown error'}</div>
  )

  const { server, containers, commands } = data

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'containers', label: 'Containers', count: containers.length },
    { key: 'commands',   label: 'Commands',   count: commands.length   },
    { key: 'metrics',    label: 'Metrics'                               },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/servers" className="text-slate-500 hover:text-slate-300 transition-colors">Servers</Link>
        <span className="text-slate-700">/</span>
        <span className="text-white">{server.name}</span>
      </div>

      {/* Server header */}
      <div className="sp-card flex items-center gap-6 flex-wrap">
        <StatusDot status={server.status} />
        <div>
          <h1 className="text-xl font-bold text-white">{server.name}</h1>
          <p className="text-slate-500 text-sm font-mono">{server.hostname}{server.ip ? ` · ${server.ip}` : ''}</p>
        </div>
        <div className="ml-auto flex gap-6">
          <Metric label="CPU"  value={server.cpu_pct} />
          <Metric label="RAM"  value={server.ram_pct} />
          <Metric label="Disk" value={server.disk_pct} />
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{server.docker_count ?? 0}</p>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">containers</p>
          </div>
        </div>
        {server.last_seen && (
          <p className="text-[11px] text-slate-700 self-end">
            Last seen {timeAgo(server.last_seen)}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="sp-card p-0 overflow-hidden">
        <div className="flex border-b border-sp-border">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                tab === t.key
                  ? 'text-sp-accent border-b-2 border-sp-accent bg-sp-accent/5'
                  : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-sp-accent/20 text-sp-accent' : 'bg-slate-700 text-slate-400'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* Containers tab */}
          {tab === 'containers' && (
            containers.length === 0 ? (
              <p className="text-slate-600 text-sm py-6 text-center">
                {server.status === 'online'
                  ? 'No containers found. Agent will report them on next heartbeat.'
                  : 'Server is offline — container data may be stale.'}
              </p>
            ) : (
              <div className="divide-y divide-sp-border">
                {containers.map(c => {
                  const running = isRunning(c.status)
                  const busy    = pending[c.name] ?? false
                  return (
                    <div key={c.id} className="flex items-center gap-4 py-3 flex-wrap">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${running ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white font-mono">{c.name}</p>
                        <p className="text-[11px] text-slate-600 truncate">{c.image}</p>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono hidden sm:block max-w-xs truncate">
                        {c.status}
                      </div>
                      {c.ports && (
                        <div className="text-[10px] text-slate-600 font-mono hidden md:block">{c.ports}</div>
                      )}
                      <div className="flex gap-1.5 shrink-0">
                        {running ? (
                          <>
                            <ActionBtn label="Stop"    color="red"    busy={busy} onClick={() => sendAction(c.name, 'stop')} />
                            <ActionBtn label="Restart" color="yellow" busy={busy} onClick={() => sendAction(c.name, 'restart')} />
                          </>
                        ) : (
                          <ActionBtn label="Start" color="green" busy={busy} onClick={() => sendAction(c.name, 'start')} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Commands tab */}
          {tab === 'commands' && (
            commands.length === 0 ? (
              <p className="text-slate-600 text-sm py-6 text-center">No commands issued yet.</p>
            ) : (
              <div className="divide-y divide-sp-border">
                {commands.map(cmd => (
                  <div key={cmd.id} className="flex items-center gap-3 py-2.5 text-xs flex-wrap">
                    <CommandStatusBadge status={cmd.status} />
                    <span className="font-mono text-slate-300">{cmd.container}</span>
                    <span className={`font-bold uppercase text-[10px] ${
                      cmd.action === 'stop'    ? 'text-red-400' :
                      cmd.action === 'start'   ? 'text-green-400' :
                      'text-yellow-400'
                    }`}>{cmd.action}</span>
                    {cmd.result && (
                      <span className="text-slate-600 font-mono truncate max-w-xs">{cmd.result}</span>
                    )}
                    <span className="text-slate-700 ml-auto">{timeAgo(cmd.created_at)}</span>
                    {cmd.requested_by && (
                      <span className="text-slate-700">by {cmd.requested_by}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Metrics tab */}
          {tab === 'metrics' && (
            mLoading && metrics.length === 0 ? (
              <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Loading metrics…</div>
            ) : metrics.length === 0 ? (
              <p className="text-slate-600 text-sm py-6 text-center">No metric history yet. Metrics are recorded on each heartbeat (every 30s).</p>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Last {metrics.length} heartbeats (oldest → newest)</p>
                  <p className="text-[10px] text-slate-700">refreshes every 30s</p>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={metrics} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v) => `${v}%`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                    <Line type="monotone" dataKey="cpu_pct"  name="CPU"  stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="ram_pct"  name="RAM"  stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="disk_pct" name="Disk" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          )}

        </div>
      </div>

      {/* Tags */}
      <div className="sp-card space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tags</h2>
        <div className="flex flex-wrap gap-2 min-h-[28px]">
          {tags.length === 0 && <p className="text-[11px] text-slate-700">No tags. Add environment labels like prod, staging, dev.</p>}
          {tags.map(t => (
            <span key={t} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border border-sp-border text-slate-400 bg-sp-hover">
              {t}
              {isAdmin && (
                <button
                  onClick={async () => {
                    const next = tags.filter(x => x !== t)
                    setTags(next)
                    await api.put(`/api/servers/${id}`, { tags: next })
                  }}
                  className="text-slate-600 hover:text-red-400 leading-none"
                >×</button>
              )}
            </span>
          ))}
        </div>
        {isAdmin && (
          <form
            onSubmit={async e => {
              e.preventDefault()
              const val = tagInput.trim().toLowerCase()
              if (!val || tags.includes(val)) { setTagInput(''); return }
              const next = [...tags, val]
              setSavingTag(true)
              try {
                await api.put(`/api/servers/${id}`, { tags: next })
                setTags(next)
                setTagInput('')
              } finally { setSavingTag(false) }
            }}
            className="flex items-center gap-2"
          >
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value.toLowerCase())}
              placeholder="e.g. prod"
              maxLength={32}
              className="w-36 bg-sp-hover border border-sp-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sp-accent"
            />
            <button
              type="submit"
              disabled={!tagInput.trim() || savingTag}
              className="px-3 py-1.5 rounded-lg bg-sp-hover border border-sp-border text-xs text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {/* Danger zone — admin only */}
      {isAdmin && (
        <div className="sp-card border border-red-500/20">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-500/70 mb-4">Danger Zone</h2>
          <div className="space-y-4">

            {/* Agent token */}
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 font-medium">Agent Token</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Use this token to reconnect an agent that lost its configuration.
                </p>
                {showToken && token && (
                  <p className="mt-2 font-mono text-[11px] text-slate-400 bg-black/30 border border-sp-border rounded-lg px-3 py-2 break-all">
                    {token}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (!showToken) fetchToken()
                  setShowToken(v => !v)
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 text-xs transition-colors"
              >
                {showToken ? 'Hide token' : 'Reveal token'}
              </button>
            </div>

            {/* Delete */}
            <div className="flex items-start gap-4 flex-wrap pt-3 border-t border-sp-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 font-medium">Delete Server</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Permanently removes this server and all its data — heartbeats, containers, deployments, backups, and alerts.
                </p>
              </div>
              <button
                onClick={deleteServer}
                disabled={deleting}
                className="shrink-0 px-4 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete Server'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === 'online') return (
    <span className="relative flex h-3 w-3 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
    </span>
  )
  return <span className={`h-3 w-3 rounded-full shrink-0 ${status === 'pending' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'}`} />
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${value != null && value > 80 ? 'text-red-400' : 'text-slate-200'}`}>
        {value != null ? `${value}%` : '–'}
      </p>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function ActionBtn({ label, color, busy, onClick }: {
  label: string; color: 'red' | 'green' | 'yellow'; busy: boolean; onClick: () => void
}) {
  const colors = {
    red:    'border-red-500/30    text-red-400    hover:bg-red-500/10',
    green:  'border-green-500/30  text-green-400  hover:bg-green-500/10',
    yellow: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10',
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors[color]}`}
    >
      {busy ? '…' : label}
    </button>
  )
}

function CommandStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    pending: 'bg-slate-700    text-slate-400',
    running: 'bg-blue-500/15  text-blue-400',
    done:    'bg-green-500/15 text-green-400',
    error:   'bg-red-500/15   text-red-400',
  }
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cfg[status] ?? cfg.pending}`}>
      {status}
    </span>
  )
}
