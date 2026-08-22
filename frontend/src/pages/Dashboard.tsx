import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceResult {
  status:     'ok' | 'error'
  latency_ms: number
  error?:     string
}

interface StatusData {
  status:         'ok' | 'degraded'
  version:        string
  env:            string
  uptime_seconds: number
  services: {
    postgres: ServiceResult
    redis:    ServiceResult
  }
  timestamp: string
}

interface ServerSummary { total: number; online: number; offline: number; containers: number }
interface ServerHealth  { name: string; cpu: number; ram: number; disk: number | null }

interface RecentDeployment {
  id:          string
  app_name:    string
  server_name: string
  status:      string
  started_at:  string
}

interface OpenAlert {
  id:          string
  server_name: string
  metric:      string
  severity:    string
  message:     string
  created_at:  string
}

// ── Stat card config ──────────────────────────────────────────────────────────

const statCardConfig = [
  { key: 'total',      label: 'Total Servers',      color: 'text-blue-400',   ring: 'ring-blue-500/20',   bg: 'bg-blue-500/10'   },
  { key: 'online',     label: 'Online Servers',     color: 'text-green-400',  ring: 'ring-green-500/20',  bg: 'bg-green-500/10'  },
  { key: 'offline',    label: 'Offline Servers',    color: 'text-red-400',    ring: 'ring-red-500/20',    bg: 'bg-red-500/10'    },
  { key: 'containers', label: 'Running Containers', color: 'text-purple-400', ring: 'ring-purple-500/20', bg: 'bg-purple-500/10' },
] as const

const DEPLOY_STATUS_COLOR: Record<string, string> = {
  success:      'text-green-400',
  failed:       'text-red-400',
  running:      'text-blue-400',
  health_check: 'text-yellow-400',
  pending:      'text-slate-500',
}

const ALERT_SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  warning:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  offline:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  usePageTitle('Dashboard')
  const [data,        setData]        = useState<StatusData | null>(null)
  const [state,       setState]       = useState<'loading' | 'ok' | 'degraded' | 'error'>('loading')
  const [summary,     setSummary]     = useState<ServerSummary>({ total: 0, online: 0, offline: 0, containers: 0 })
  const [health,      setHealth]      = useState<ServerHealth[]>([])
  const [deployments, setDeployments] = useState<RecentDeployment[]>([])
  const [alerts,      setAlerts]      = useState<OpenAlert[]>([])

  const pollStatus = () => {
    fetch('/api/status')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((d: StatusData) => { setData(d); setState(d.status === 'ok' ? 'ok' : 'degraded') })
      .catch(() => { setState('error'); setData(null) })
  }

  const pollServers = () => {
    api.get('/api/servers')
      .then(r => r.ok ? r.json() : null)
      .then((d: { summary: ServerSummary } | null) => { if (d) setSummary(d.summary) })
      .catch(() => {})
  }

  const pollHealth = () => {
    api.get('/api/monitoring/summary')
      .then(r => r.ok ? r.json() : null)
      .then((d: { servers: { name: string; cpu_pct: number | null; ram_pct: number | null; disk_pct: number | null }[] } | null) => {
        if (d) setHealth(d.servers.map(s => ({
          name: s.name,
          cpu:  Math.round(s.cpu_pct ?? 0),
          ram:  Math.round(s.ram_pct ?? 0),
          disk: s.disk_pct != null ? Math.round(s.disk_pct) : null,
        })))
      })
      .catch(() => {})
  }

  const pollDeployments = () => {
    api.get('/api/deployments?limit=8')
      .then(r => r.ok ? r.json() : null)
      .then((d: { deployments: RecentDeployment[] } | null) => { if (d) setDeployments(d.deployments) })
      .catch(() => {})
  }

  const pollAlerts = () => {
    api.get('/api/alerts')
      .then(r => r.ok ? r.json() : null)
      .then((d: { alerts: OpenAlert[] } | null) => { if (d) setAlerts(d.alerts.slice(0, 6)) })
      .catch(() => {})
  }

  useEffect(() => {
    pollStatus(); pollServers(); pollHealth(); pollDeployments(); pollAlerts()
    const t1 = setInterval(pollStatus,  30_000)
    const t2 = setInterval(pollServers, 30_000)
    const t3 = setInterval(pollHealth,  30_000)
    const t4 = setInterval(pollDeployments, 15_000)
    const t5 = setInterval(pollAlerts,      15_000)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); clearInterval(t5) }
  }, [])

  // Fleet averages — computed from health (per-server latest heartbeat)
  const onlineHealth = health.filter(s => s.cpu > 0 || s.ram > 0)
  const avg = (vals: (number | null)[]) => {
    const valid = vals.filter((v): v is number => v !== null)
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
  }
  const fleetCpu  = avg(onlineHealth.map(s => s.cpu))
  const fleetRam  = avg(onlineHealth.map(s => s.ram))
  const fleetDisk = avg(onlineHealth.map(s => s.disk))
  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount  = alerts.filter(a => a.severity === 'warning').length

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">ServerPilot — Control Plane</p>
        </div>
        {data && (
          <div className="text-right">
            <p className="text-xs text-slate-600">Uptime</p>
            <p className="text-sm font-mono text-slate-400">{formatUptime(data.uptime_seconds)}</p>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCardConfig.map(c => (
          <div key={c.key} className={`sp-card ring-1 ${c.ring} ${c.bg}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
            <p className={`text-4xl font-bold mt-2 ${c.color}`}>{summary[c.key]}</p>
          </div>
        ))}
      </div>

      {/* Fleet Overview */}
      {health.length > 0 && (
        <div className="sp-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Fleet Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <FleetMetric label="Avg CPU" value={fleetCpu} unit="%" servers={onlineHealth.length} />
            <FleetMetric label="Avg RAM" value={fleetRam} unit="%" servers={onlineHealth.length} />
            <FleetMetric label="Avg Disk" value={fleetDisk} unit="%" servers={onlineHealth.length} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Active Alerts</p>
              {criticalCount === 0 && warningCount === 0 ? (
                <p className="text-green-400 text-sm font-semibold">All clear</p>
              ) : (
                <div className="space-y-1">
                  {criticalCount > 0 && (
                    <p className="text-red-400 text-sm font-bold">{criticalCount} critical</p>
                  )}
                  {warningCount > 0 && (
                    <p className="text-yellow-400 text-sm font-semibold">{warningCount} warning</p>
                  )}
                </div>
              )}
              <p className="text-[10px] text-slate-600 mt-1">{onlineHealth.length} server{onlineHealth.length !== 1 ? 's' : ''} reporting</p>
            </div>
          </div>
        </div>
      )}

      {/* Status + Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Infrastructure status */}
        <div className="sp-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Infrastructure</h2>
            <span className="text-[10px] font-mono text-slate-700">polls every 30s</span>
          </div>
          <div className="space-y-1">
            <ServiceRow
              name="Backend API"
              status={state === 'loading' ? 'checking' : state === 'error' ? 'error' : 'ok'}
              latency={null}
              detail={data ? `v${data.version} · ${data.env}` : undefined}
            />
            <ServiceRow
              name="PostgreSQL"
              status={svcState(data?.services.postgres)}
              latency={data?.services.postgres.latency_ms ?? null}
              detail={data?.services.postgres.error}
            />
            <ServiceRow
              name="Redis"
              status={svcState(data?.services.redis)}
              latency={data?.services.redis.latency_ms ?? null}
              detail={data?.services.redis.error}
            />
          </div>
          {data?.timestamp && (
            <p className="text-[10px] text-slate-700 mt-4 font-mono">
              Last check: {new Date(data.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Open Alerts */}
        <div className="sp-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-sp-border flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open Alerts</h2>
            <Link to="/alerts" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">View all →</Link>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-green-400 text-sm font-semibold">All clear</p>
              <p className="text-slate-600 text-xs mt-1">No open alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-sp-border">
              {alerts.map(a => (
                <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                  <span className={`mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${ALERT_SEVERITY_COLOR[a.severity] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                    {a.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-300 truncate">{a.server_name} — {a.metric.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-slate-600 truncate">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Server Health chart */}
      {health.length > 0 && (
        <div className="sp-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Server Health</h2>
            <Link to="/monitoring" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">View all →</Link>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={health} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
              barCategoryGap="30%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Bar dataKey="cpu" name="CPU" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="ram" name="RAM" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Deployments */}
      <div className="sp-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sp-border flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent Deployments</h2>
          <Link to="/deployments" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">View all →</Link>
        </div>
        {deployments.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-600 text-sm">No deployments yet</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {deployments.map(d => (
                <tr key={d.id} className="border-b border-sp-border last:border-0 hover:bg-sp-hover transition-colors">
                  <td className="px-4 py-2.5">
                    <Link to={`/applications/${d.id}`} className="text-slate-300 hover:text-white font-medium text-xs transition-colors">
                      {d.app_name}
                    </Link>
                    <p className="text-[10px] text-slate-600 font-mono">{d.server_name}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold ${DEPLOY_STATUS_COLOR[d.status] || 'text-slate-500'}`}>
                      {d.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[10px] text-slate-600 font-mono whitespace-nowrap">
                    {timeAgo(d.started_at)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link to={`/deployments/${d.id}`} className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors">
                      log →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FleetMetric({ label, value, unit, servers }: {
  label:   string
  value:   number | null
  unit:    string
  servers: number
}) {
  const pct = value ?? 0
  const color = pct >= 85 ? 'bg-red-500'    :
                pct >= 70 ? 'bg-yellow-500'  :
                            'bg-green-500'
  const textColor = pct >= 85 ? 'text-red-400'    :
                    pct >= 70 ? 'text-yellow-400'  :
                                'text-green-400'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {value !== null
          ? <p className={`text-lg font-bold ${textColor}`}>{value}{unit}</p>
          : <p className="text-slate-600 text-sm">—</p>
        }
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-600 mt-1">
        {value !== null ? (pct >= 85 ? 'critical' : pct >= 70 ? 'elevated' : 'normal') : 'no data'}
        {' · '}{servers} server{servers !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

type RowStatus = 'ok' | 'error' | 'checking'

function ServiceRow({ name, status, latency, detail }: {
  name:    string
  status:  RowStatus
  latency: number | null
  detail?: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-sp-border last:border-0">
      <StatusDot status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300">{name}</p>
        {detail && <p className="text-[11px] text-slate-600 truncate">{detail}</p>}
      </div>
      <div className="text-right shrink-0">
        <span className={`text-xs font-mono font-semibold ${
          status === 'ok'       ? 'text-green-400' :
          status === 'error'    ? 'text-red-400'   :
          'text-slate-600'
        }`}>
          {status === 'ok' ? 'ONLINE' : status === 'error' ? 'OFFLINE' : 'CHECKING'}
        </span>
        {latency !== null && status === 'ok' && (
          <p className="text-[10px] text-slate-700 font-mono">{latency}ms</p>
        )}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: RowStatus }) {
  if (status === 'ok') return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
    </span>
  )
  if (status === 'error') return <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
  return <span className="h-2.5 w-2.5 rounded-full bg-slate-700 shrink-0 animate-pulse" />
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function svcState(s?: ServiceResult): RowStatus {
  if (!s) return 'checking'
  return s.status === 'ok' ? 'ok' : 'error'
}

function formatUptime(s: number): string {
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)   return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

