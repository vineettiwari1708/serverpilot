import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Server {
  id:            string
  name:          string
  hostname:      string
  ip:            string | null
  tags:          string[]
  status:        'online' | 'offline' | 'pending'
  last_seen:     string | null
  registered_at: string
  cpu_pct:       number | null
  ram_pct:       number | null
  disk_pct:      number | null
  docker_count:  number | null
}

interface Summary { total: number; online: number; offline: number; containers: number }

// ── Component ─────────────────────────────────────────────────────────────────

export default function Servers() {
  usePageTitle('Servers')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [servers,      setServers]      = useState<Server[]>([])
  const [summary,      setSummary]      = useState<Summary>({ total: 0, online: 0, offline: 0, containers: 0 })
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [showOnboard,  setShowOnboard]  = useState(false)
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const [tagFilter,    setTagFilter]    = useState('')

  const isAdmin = user?.role === 'admin'

  const fetchServers = useCallback(async () => {
    try {
      const res = await api.get('/api/servers')
      if (!res.ok) { setError('Failed to load servers'); return }
      const data = await res.json()
      setServers(data.servers)
      setSummary(data.summary)
      setError('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServers()
    const t = setInterval(fetchServers, 30_000)
    return () => clearInterval(t)
  }, [fetchServers])

  const deleteServer = async (e: React.MouseEvent, server: Server) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${server.name}"?\n\nThis removes all heartbeat data, containers, deployments, backups and alerts for this server. This cannot be undone.`)) return
    setDeleting(server.id)
    try {
      const r = await api.delete(`/api/servers/${server.id}`)
      if (r.ok) await fetchServers()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Servers</h1>
          <p className="text-slate-500 text-sm mt-0.5">Agent-connected servers — updates every 30s</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchServers}
            className="px-3 py-1.5 rounded-lg bg-sp-hover border border-sp-border text-slate-400 hover:text-white text-xs transition-colors">
            Refresh
          </button>
          {isAdmin && (
            <button onClick={() => setShowOnboard(true)}
              className="px-4 py-1.5 rounded-lg bg-sp-accent text-white text-xs font-semibold hover:bg-sp-accent/80 transition-colors">
              + Add Server
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Servers"      value={summary.total}      color="text-blue-400"   bg="bg-blue-500/10"   ring="ring-blue-500/20" />
        <SummaryCard label="Online"             value={summary.online}     color="text-green-400"  bg="bg-green-500/10"  ring="ring-green-500/20" />
        <SummaryCard label="Offline"            value={summary.offline}    color="text-red-400"    bg="bg-red-500/10"    ring="ring-red-500/20" />
        <SummaryCard label="Running Containers" value={summary.containers} color="text-purple-400" bg="bg-purple-500/10" ring="ring-purple-500/20" />
      </div>

      {/* Tag filter */}
      {servers.some(s => s.tags?.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">Filter:</span>
          <button
            onClick={() => setTagFilter('')}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${!tagFilter ? 'border-sp-accent text-sp-accent bg-sp-accent/10' : 'border-sp-border text-slate-500 hover:text-slate-300'}`}
          >
            All
          </button>
          {Array.from(new Set(servers.flatMap(s => s.tags ?? []))).sort().map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
              className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${tagFilter === tag ? 'border-sp-accent text-sp-accent bg-sp-accent/10' : 'border-sp-border text-slate-500 hover:text-slate-300'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Server list */}
      <div className="sp-card">
        {loading && <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Loading servers…</div>}
        {!loading && error && <div className="py-12 text-center text-red-400 text-sm">{error}</div>}
        {!loading && !error && servers.length === 0 && <EmptyState onAdd={() => setShowOnboard(true)} isAdmin={isAdmin} />}
        {!loading && !error && servers.length > 0 && (() => {
          const visible = tagFilter ? servers.filter(s => s.tags?.includes(tagFilter)) : servers
          return (
          <div className="divide-y divide-sp-border">
            {visible.length === 0 && (
              <p className="py-8 text-center text-slate-600 text-sm">No servers tagged "{tagFilter}".</p>
            )}
            {visible.map(s => (
              <ServerRow
                key={s.id}
                server={s}
                isAdmin={isAdmin}
                deleting={deleting === s.id}
                onDelete={e => deleteServer(e, s)}
                onView={() => navigate(`/servers/${s.id}`)}
              />
            ))}
          </div>
          )
        })()}
      </div>

      {/* Onboarding modal */}
      {showOnboard && <OnboardModal onClose={() => setShowOnboard(false)} />}

    </div>
  )
}

// ── Server row ────────────────────────────────────────────────────────────────

function ServerRow({ server: s, isAdmin, deleting, onDelete, onView }: {
  server:   Server
  isAdmin:  boolean
  deleting: boolean
  onDelete: (e: React.MouseEvent) => void
  onView:   () => void
}) {
  return (
    <div
      onClick={onView}
      className="flex items-center gap-4 py-3.5 px-1 hover:bg-sp-hover/30 transition-colors rounded-lg group cursor-pointer"
    >
      <StatusDot status={s.status} />

      <div className="min-w-0 w-44">
        <p className="text-sm font-medium text-white truncate">{s.name}</p>
        <p className="text-[11px] text-slate-600 font-mono truncate">{s.hostname}</p>
        {s.ip && <p className="text-[10px] text-slate-700 font-mono">{s.ip}</p>}
      </div>

      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
        s.status === 'online'  ? 'bg-green-500/10  text-green-400  border-green-500/20'  :
        s.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                  'bg-red-500/10    text-red-400    border-red-500/20'
      }`}>
        {s.status.toUpperCase()}
      </span>

      {s.tags && s.tags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {s.tags.map(t => (
            <span key={t} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-sp-border text-slate-600 bg-sp-hover">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 flex-1 min-w-0">
        <MetricBar label="CPU" value={s.cpu_pct} color="bg-blue-500" />
        <MetricBar label="RAM" value={s.ram_pct} color="bg-purple-500" />
      </div>

      {s.docker_count != null && (
        <div className="text-center shrink-0 w-14">
          <p className="text-lg font-bold text-slate-300">{s.docker_count}</p>
          <p className="text-[10px] text-slate-600">containers</p>
        </div>
      )}

      <div className="text-right shrink-0 w-28 flex flex-col items-end gap-1">
        <p className="text-[10px] text-slate-600">
          {s.last_seen ? timeAgo(s.last_seen) : 'never'}
        </p>
        <span className="text-[10px] text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
          View →
        </span>
      </div>

      {isAdmin && (
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete server"
          className="shrink-0 opacity-0 group-hover:opacity-100 text-[10px] text-red-500/50 hover:text-red-400 transition-all disabled:opacity-30 font-mono px-1"
        >
          {deleting ? '…' : 'del'}
        </button>
      )}
    </div>
  )
}

// ── Onboarding modal ──────────────────────────────────────────────────────────

function OnboardModal({ onClose }: { onClose: () => void }) {
  const controlUrl = `http://${window.location.hostname}:8081`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-sp-surface border border-sp-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-sp-border">
          <h2 className="text-base font-bold text-white">Add a Server</h2>
          <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors text-lg">×</button>
        </div>

        <div className="px-6 py-5 space-y-5 text-sm">

          <p className="text-slate-400">
            Install the agent on any Linux server with Node.js and Docker. The agent registers itself on first run.
          </p>

          <Step n={1} title="Prerequisites">
            <p className="text-slate-500 text-xs">Node.js 18+ and Docker must be installed on the target server.</p>
          </Step>

          <Step n={2} title="Copy the agent">
            <CodeBlock>{`# From this machine, copy agent.js to the target server:
scp agent/agent.js user@TARGET_SERVER:/opt/serverpilot/agent.js`}</CodeBlock>
          </Step>

          <Step n={3} title="Configure environment variables">
            <CodeBlock>{`export CONTROL_URL="${controlUrl}"
export AGENT_SECRET="changeme"    # Must match AGENT_SECRET in your .env
export SERVER_NAME="my-server"    # Display name in the dashboard`}</CodeBlock>
            <p className="text-[11px] text-slate-600 mt-2">
              AGENT_SECRET must match the value in your backend <code className="text-slate-500">.env</code> file.
            </p>
          </Step>

          <Step n={4} title="Run the agent">
            <CodeBlock>{`node /opt/serverpilot/agent.js`}</CodeBlock>
            <p className="text-[11px] text-slate-600 mt-2">
              The agent will register itself and appear in the dashboard within 30 seconds.
            </p>
          </Step>

          <Step n={5} title="Run as a service (optional)">
            <CodeBlock>{`# Create a systemd service
cat > /etc/systemd/system/serverpilot-agent.service << 'EOF'
[Unit]
Description=ServerPilot Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Environment=CONTROL_URL=${controlUrl}
Environment=AGENT_SECRET=changeme
Environment=SERVER_NAME=my-server
ExecStart=/usr/bin/node /opt/serverpilot/agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now serverpilot-agent`}</CodeBlock>
          </Step>

          <div className="bg-sp-hover border border-sp-border rounded-xl p-4 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-400">Supported targets</p>
            <div className="grid grid-cols-2 gap-x-4 mt-2">
              {['Ubuntu 20.04+', 'Debian 11+', 'AWS EC2', 'DigitalOcean Droplet', 'Hetzner VPS', 'Raspberry Pi 4 (ARM64)'].map(t => (
                <span key={t} className="text-slate-600">· {t}</span>
              ))}
            </div>
          </div>

        </div>

        <div className="px-6 py-4 border-t border-sp-border flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 rounded-lg bg-sp-accent text-white text-xs font-semibold hover:bg-sp-accent/80 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="h-5 w-5 rounded-full bg-sp-accent/20 border border-sp-accent/30 text-sp-accent text-[10px] font-bold flex items-center justify-center shrink-0">
          {n}
        </span>
        <p className="text-xs font-semibold text-slate-300">{title}</p>
      </div>
      <div className="ml-7">{children}</div>
    </div>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative group">
      <pre className="bg-black/40 border border-sp-border rounded-lg px-4 py-3 text-[11px] text-slate-400 font-mono overflow-x-auto leading-relaxed">
        {children}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[9px] font-bold px-2 py-0.5 rounded border border-sp-border bg-sp-surface text-slate-500 hover:text-white transition-all"
      >
        {copied ? 'COPIED' : 'COPY'}
      </button>
    </div>
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
        <div className={`h-full rounded-full transition-all ${color} ${pct > 80 ? 'opacity-100' : 'opacity-70'}`}
          style={{ width: `${pct}%` }} />
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

function EmptyState({ onAdd, isAdmin }: { onAdd: () => void; isAdmin: boolean }) {
  return (
    <div className="py-16 text-center space-y-4">
      <p className="text-slate-500 text-sm">No servers registered yet.</p>
      <p className="text-slate-700 text-xs max-w-sm mx-auto leading-relaxed">
        Deploy the agent to any server to register it automatically.
      </p>
      {isAdmin && (
        <button onClick={onAdd}
          className="mt-2 px-5 py-2 rounded-lg bg-sp-accent text-white text-xs font-semibold hover:bg-sp-accent/80 transition-colors">
          + Add Server
        </button>
      )}
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
