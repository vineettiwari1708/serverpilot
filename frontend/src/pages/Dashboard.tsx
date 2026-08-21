import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

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

// ── Stat card config ──────────────────────────────────────────────────────────

const statCardConfig = [
  { key: 'total',      label: 'Total Servers',      color: 'text-blue-400',   ring: 'ring-blue-500/20',   bg: 'bg-blue-500/10'   },
  { key: 'online',     label: 'Online Servers',     color: 'text-green-400',  ring: 'ring-green-500/20',  bg: 'bg-green-500/10'  },
  { key: 'offline',    label: 'Offline Servers',    color: 'text-red-400',    ring: 'ring-red-500/20',    bg: 'bg-red-500/10'    },
  { key: 'containers', label: 'Running Containers', color: 'text-purple-400', ring: 'ring-purple-500/20', bg: 'bg-purple-500/10' },
] as const

interface ServerSummary { total: number; online: number; offline: number; containers: number }

// ── Build phases tracker ──────────────────────────────────────────────────────

const phases = [
  { id: '1a', label: 'Skeleton + Infrastructure',      done: true  },
  { id: '1b', label: 'Auth + Database Schema',         done: true  },
  { id: '2',  label: 'Agent Registration + Heartbeat', done: true  },
  { id: '3',  label: 'Docker Container Management',    done: true  },
  { id: '4',  label: 'Application Deployment',         done: true  },
  { id: '5',  label: 'Backup + Restore',               done: false },
  { id: '6',  label: 'Alerts + Monitoring',            done: false },
  { id: '7',  label: 'Polish + Charts',                done: false },
]

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data,    setData]    = useState<StatusData | null>(null)
  const [state,   setState]   = useState<'loading' | 'ok' | 'degraded' | 'error'>('loading')
  const [summary, setSummary] = useState<ServerSummary>({ total: 0, online: 0, offline: 0, containers: 0 })

  useEffect(() => {
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
    pollStatus()
    pollServers()
    const t1 = setInterval(pollStatus,  30_000)
    const t2 = setInterval(pollServers, 30_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">ServerPilot Local — Control Plane</p>
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

      {/* Status + Progress row */}
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

        {/* Build progress */}
        <div className="sp-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Build Progress</h2>
          <div className="space-y-1.5">
            {phases.map(p => (
              <Link
                key={p.id}
                to={`/docs/${p.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-sp-hover transition-colors group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                  p.done
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-transparent text-slate-700 border-sp-border group-hover:border-slate-600'
                }`}>
                  {p.done ? '✓' : p.id.toUpperCase()}
                </div>
                <span className={`text-sm flex-1 ${p.done ? 'text-slate-300' : 'text-slate-600 group-hover:text-slate-400'}`}>
                  {p.label}
                </span>
                {p.done
                  ? <span className="text-[10px] font-bold text-green-500 tracking-wider">DONE</span>
                  : <span className="text-[10px] text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                }
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* Quick links */}
      <div className="sp-card">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">API Endpoints</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/health',      label: 'GET /health'      },
            { href: '/api/health',  label: 'GET /api/health'  },
            { href: '/api/status',  label: 'GET /api/status'  },
            { href: 'http://localhost:8080', label: 'Traefik :8080', external: true },
          ].map(l => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-sp-hover border border-sp-border text-slate-500 hover:text-slate-200 hover:border-slate-600 transition-colors text-xs font-mono"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
