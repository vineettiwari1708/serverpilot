import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'

interface AuditEvent {
  id:          string
  user_name:   string
  action:      string
  resource:    string
  resource_id: string
  detail:      Record<string, unknown>
  ip:          string
  created_at:  string
}

interface ApiResponse {
  events: AuditEvent[]
  total:  number
  limit:  number
  offset: number
}

const ACTION_COLORS: Record<string, string> = {
  'app.create':       'text-green-400',
  'app.deploy':       'text-blue-400',
  'app.rollback':     'text-yellow-400',
  'container.action': 'text-purple-400',
  'user.create':      'text-green-400',
  'user.update':      'text-blue-400',
  'user.delete':      'text-red-400',
  'backup.create':    'text-teal-400',
  'backup.restore':   'text-orange-400',
}

const RESOURCE_OPTIONS = ['', 'application', 'deployment', 'container', 'user', 'backup']
const ACTION_OPTIONS   = ['', 'app', 'container', 'user', 'backup']

const LIMIT = 50

export default function AuditLog() {
  usePageTitle('Audit Log')
  const [data,       setData]       = useState<ApiResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [resource,   setResource]   = useState('')
  const [action,     setAction]     = useState('')
  const [offset,     setOffset]     = useState(0)

  const load = useCallback(async (res: string, act: string, off: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
      if (res) params.set('resource', res)
      if (act) params.set('action', act)
      const r = await api.get(`/api/audit-logs?${params}`)
      if (r.ok) setData(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(resource, action, offset) }, [load, resource, action, offset])

  const handleFilter = (res: string, act: string) => {
    setResource(res)
    setAction(act)
    setOffset(0)
  }

  const total = data?.total ?? 0
  const pages = Math.ceil(total / LIMIT)
  const page  = Math.floor(offset / LIMIT)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">

      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">All mutating actions taken through the UI</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500 uppercase tracking-wider">Resource</label>
          <select
            className="bg-sp-hover border border-sp-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sp-accent"
            value={resource}
            onChange={e => handleFilter(e.target.value, action)}
          >
            {RESOURCE_OPTIONS.map(r => (
              <option key={r} value={r}>{r || 'All'}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500 uppercase tracking-wider">Action</label>
          <select
            className="bg-sp-hover border border-sp-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sp-accent"
            value={action}
            onChange={e => handleFilter(resource, e.target.value)}
          >
            {ACTION_OPTIONS.map(a => (
              <option key={a} value={a}>{a || 'All'}</option>
            ))}
          </select>
        </div>
        {total > 0 && (
          <p className="text-[11px] text-slate-600 ml-auto">{total} event{total !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Table */}
      <div className="sp-card p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Loading…</div>
        ) : !data?.events.length ? (
          <div className="py-12 text-center text-slate-600 text-sm">No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-sp-border">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Time</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">User</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Resource</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Detail</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hidden lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sp-border">
                {data.events.map(e => (
                  <tr key={e.id} className="hover:bg-sp-hover/50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                      {formatTime(e.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-medium whitespace-nowrap">
                      {e.user_name}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`font-mono font-semibold ${ACTION_COLORS[e.action] ?? 'text-slate-400'}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {e.resource}
                      {e.resource_id && (
                        <span className="ml-1.5 text-slate-700 font-mono text-[10px]">
                          {e.resource_id.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono max-w-xs">
                      {Object.entries(e.detail ?? {}).map(([k, v]) => (
                        <span key={k} className="mr-2">
                          <span className="text-slate-700">{k}=</span>
                          <span className="text-slate-500">{String(v)}</span>
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 font-mono hidden lg:table-cell">{e.ip}</td>
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
          <p className="text-[11px] text-slate-600">
            Page {page + 1} of {pages}
          </p>
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

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

