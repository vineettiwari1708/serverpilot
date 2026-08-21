import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'

interface Command {
  id:           string
  server_id:    string
  container:    string
  action:       string
  status:       string
  result:       string
  requested_by: string
  created_at:   string
}

interface Server { id: string; name: string }

const LIMIT = 100

export default function Logs() {
  const [servers,  setServers]  = useState<Server[]>([])
  const [serverId, setServerId] = useState('')
  const [commands, setCommands] = useState<Command[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [offset,   setOffset]   = useState(0)

  useEffect(() => {
    api.get('/api/servers')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.servers) setServers(d.servers) })
  }, [])

  const load = useCallback(async (sid: string, off: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
      if (sid) params.set('server_id', sid)
      const r = await api.get(`/api/container-commands?${params}`)
      if (r.ok) { const d = await r.json(); setCommands(d.commands); setTotal(d.total) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(serverId, offset) }, [load, serverId, offset])

  const serverName = (id: string) => servers.find(s => s.id === id)?.name ?? id.slice(0, 8)

  const pages = Math.ceil(total / LIMIT)
  const page  = Math.floor(offset / LIMIT)

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      <div>
        <h1 className="text-2xl font-bold text-white">Container Activity</h1>
        <p className="text-slate-500 text-sm mt-0.5">History of all container control commands</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[11px] text-slate-500 uppercase tracking-wider">Server</label>
        <select
          className="bg-sp-hover border border-sp-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sp-accent"
          value={serverId}
          onChange={e => { setServerId(e.target.value); setOffset(0) }}
        >
          <option value="">All servers</option>
          {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {total > 0 && (
          <p className="text-[11px] text-slate-600 ml-auto">{total} command{total !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Log table */}
      <div className="sp-card p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Loading…</div>
        ) : commands.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">
            No container commands yet. Use the Servers page to start, stop, or restart containers.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="border-b border-sp-border">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 not-italic">Time</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 not-italic hidden sm:table-cell">Server</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 not-italic">Container</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 not-italic">Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 not-italic">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 not-italic">Result</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 not-italic hidden md:table-cell">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sp-border/50">
                {commands.map(c => (
                  <tr key={c.id} className="hover:bg-sp-hover/30 transition-colors">
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{fmtTime(c.created_at)}</td>
                    <td className="px-4 py-2 text-slate-500 hidden sm:table-cell">{serverName(c.server_id)}</td>
                    <td className="px-4 py-2 text-slate-300 max-w-[12rem] truncate">{c.container}</td>
                    <td className="px-4 py-2">
                      <span className={`font-bold uppercase ${
                        c.action === 'stop'    ? 'text-red-400'    :
                        c.action === 'start'   ? 'text-green-400'  :
                        'text-yellow-400'
                      }`}>{c.action}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        c.status === 'done'    ? 'bg-green-500/15 text-green-400' :
                        c.status === 'error'   ? 'bg-red-500/15   text-red-400'   :
                        c.status === 'running' ? 'bg-blue-500/15  text-blue-400'  :
                        'bg-slate-700 text-slate-400'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600 max-w-[16rem] truncate">{c.result || '—'}</td>
                    <td className="px-4 py-2 text-slate-700 hidden md:table-cell">{c.requested_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-600">Page {page + 1} of {pages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded-lg border border-sp-border text-xs text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setOffset(o => o + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="px-3 py-1.5 rounded-lg border border-sp-border text-xs text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
