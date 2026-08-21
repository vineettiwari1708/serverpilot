import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Server {
  id:            string
  name:          string
  hostname:      string
  ip:            string | null
  status:        'online' | 'offline' | 'pending'
  last_seen:     string | null
  registered_at: string
  cpu_pct:       number | null
  ram_pct:       number | null
  disk_pct:      number | null
  docker_count:  number | null
}

interface Summary {
  total:      number
  online:     number
  offline:    number
  containers: number
}

interface ServersResponse {
  servers: Server[]
  summary: Summary
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Servers() {
  const [servers,  setServers]  = useState<Server[]>([])
  const [summary,  setSummary]  = useState<Summary>({ total: 0, online: 0, offline: 0, containers: 0 })
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const fetchServers = async () => {
    try {
      const res = await api.get('/api/servers')
      if (!res.ok) { setError('Failed to load servers'); return }
      const data = await res.json() as ServersResponse
      setServers(data.servers)
      setSummary(data.summary)
      setError('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServers()
    const t = setInterval(fetchServers, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Servers</h1>
          <p className="text-slate-500 text-sm mt-0.5">Agent-connected servers — updates every 30s</p>
        </div>
        <button
          onClick={fetchServers}
          className="px-3 py-1.5 rounded-lg bg-sp-hover border border-sp-border text-slate-400 hover:text-white text-xs transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Servers"      value={summary.total}      color="text-blue-400"   bg="bg-blue-500/10"   ring="ring-blue-500/20" />
        <SummaryCard label="Online"             value={summary.online}     color="text-green-400"  bg="bg-green-500/10"  ring="ring-green-500/20" />
        <SummaryCard label="Offline"            value={summary.offline}    color="text-red-400"    bg="bg-red-500/10"    ring="ring-red-500/20" />
        <SummaryCard label="Running Containers" value={summary.containers} color="text-purple-400" bg="bg-purple-500/10" ring="ring-purple-500/20" />
      </div>

      {/* Server list */}
      <div className="sp-card">
        {loading && (
          <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Loading servers…</div>
        )}

        {!loading && error && (
          <div className="py-12 text-center text-red-400 text-sm">{error}</div>
        )}

        {!loading && !error && servers.length === 0 && (
          <EmptyState />
        )}

        {!loading && !error && servers.length > 0 && (
          <div className="divide-y divide-sp-border">
            {servers.map(s => <ServerRow key={s.id} server={s} />)}
          </div>
        )}
      </div>

    </div>
  )
}

// ── Server row ────────────────────────────────────────────────────────────────

function ServerRow({ server: s }: { server: Server }) {
  return (
    <Link to={`/servers/${s.id}`} className="flex items-center gap-4 py-3.5 px-1 hover:bg-sp-hover/30 transition-colors rounded-lg group">

      {/* Status dot */}
      <StatusDot status={s.status} />

      {/* Name + hostname */}
      <div className="min-w-0 w-44">
        <p className="text-sm font-medium text-white truncate">{s.name}</p>
        <p className="text-[11px] text-slate-600 font-mono truncate">{s.hostname}</p>
        {s.ip && <p className="text-[10px] text-slate-700 font-mono">{s.ip}</p>}
      </div>

      {/* Status badge */}
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
        s.status === 'online'  ? 'bg-green-500/10  text-green-400  border-green-500/20'  :
        s.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                  'bg-red-500/10    text-red-400    border-red-500/20'
      }`}>
        {s.status.toUpperCase()}
      </span>

      {/* Metrics */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <MetricBar label="CPU" value={s.cpu_pct} color="bg-blue-500" />
        <MetricBar label="RAM" value={s.ram_pct} color="bg-purple-500" />
      </div>

      {/* Docker count */}
      {s.docker_count != null && (
        <div className="text-center shrink-0 w-14">
          <p className="text-lg font-bold text-slate-300">{s.docker_count}</p>
          <p className="text-[10px] text-slate-600">containers</p>
        </div>
      )}

      {/* Last seen + arrow */}
      <div className="text-right shrink-0 w-28 flex flex-col items-end gap-1">
        <p className="text-[10px] text-slate-600">
          {s.last_seen ? timeAgo(s.last_seen) : 'never'}
        </p>
        <span className="text-[10px] text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
          View →
        </span>
      </div>

    </Link>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === 'online') return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
    </span>
  )
  if (status === 'pending') return <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 shrink-0 animate-pulse" />
  return <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
}

function MetricBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = value ?? 0
  return (
    <div className="flex-1 min-w-0 max-w-28">
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-slate-600">{label}</span>
        <span className="text-[10px] text-slate-500 font-mono">{value != null ? `${pct}%` : '–'}</span>
      </div>
      <div className="h-1 bg-sp-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color} ${pct > 80 ? 'opacity-100' : 'opacity-70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, bg, ring }: {
  label: string; value: number; color: string; bg: string; ring: string
}) {
  return (
    <div className={`sp-card ring-1 ${ring} ${bg}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-4xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-16 text-center space-y-3">
      <p className="text-slate-500 text-sm">No servers registered yet.</p>
      <p className="text-slate-700 text-xs max-w-sm mx-auto leading-relaxed">
        Run the agent on any server to register it. See <code className="text-slate-500">agent/agent.js</code> — register first, then start the agent with the returned token.
      </p>
      <div className="inline-block mt-2 px-4 py-2.5 bg-sp-hover rounded-xl border border-sp-border text-left">
        <pre className="text-[11px] text-slate-400 font-mono leading-relaxed">{`# 1. Register
curl -X POST http://localhost:8081/api/agent/register \\
  -H "Content-Type: application/json" \\
  -d '{"name":"my-server","hostname":"server1",
       "agent_secret":"changeme"}'

# 2. Start the agent
AGENT_TOKEN=<token from above> \\
CONTROL_URL=http://localhost:8081 \\
node agent/agent.js`}</pre>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}
