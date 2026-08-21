import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'

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
  id:         string
  name:       string
  hostname:   string
  ip:         string | null
  status:     'online' | 'offline' | 'pending'
  last_seen:  string | null
  cpu_pct:    number | null
  ram_pct:    number | null
  disk_pct:   number | null
  docker_count: number | null
}

interface DetailResponse {
  server:     ServerInfo
  containers: Container[]
  commands:   Command[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRunning(status: string) {
  return /^up/i.test(status)
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ServerDetail() {
  const { id }  = useParams<{ id: string }>()
  const [data,    setData]    = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [pending, setPending] = useState<Record<string, boolean>>({}) // name→true while action in flight

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/api/servers/${id}`)
      if (!res.ok) { setError('Server not found'); return }
      const d = await res.json() as DetailResponse
      setData(d)
      setError('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 15_000)
    return () => clearInterval(t)
  }, [fetchData])

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

      {/* Containers */}
      <div className="sp-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Containers</h2>
          <span className="text-[10px] text-slate-700">synced every heartbeat</span>
        </div>

        {containers.length === 0 ? (
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
                    <div className="text-[10px] text-slate-600 font-mono hidden md:block">
                      {c.ports}
                    </div>
                  )}

                  {/* Action buttons */}
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
        )}
      </div>

      {/* Recent commands */}
      {commands.length > 0 && (
        <div className="sp-card">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Recent Commands</h2>
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
                {cmd.result && <span className="text-slate-600 font-mono truncate max-w-xs">{cmd.result}</span>}
                <span className="text-slate-700 ml-auto">{timeAgo(cmd.created_at)}</span>
                {cmd.requested_by && (
                  <span className="text-slate-700">by {cmd.requested_by}</span>
                )}
              </div>
            ))}
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
