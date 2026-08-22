import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'

interface Deployment {
  id:          string
  app_id:      string
  app_name:    string
  server_name: string
  status:      string
  deployed_by: string | null
  started_at:  string
  finished_at: string | null
}

const STATUS_TABS = ['all', 'pending', 'running', 'health_check', 'success', 'failed'] as const
const LIMIT = 50

const STATUS_CFG: Record<string, string> = {
  pending:      'bg-slate-700       text-slate-300',
  running:      'bg-blue-500/15     text-blue-400',
  health_check: 'bg-yellow-500/15   text-yellow-400',
  success:      'bg-green-500/15    text-green-400',
  failed:       'bg-red-500/15      text-red-400',
  rolling_back: 'bg-orange-500/15   text-orange-400',
  rolled_back:  'bg-slate-600       text-slate-400',
}

export default function Deployments() {
  usePageTitle('Deployments')
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [status,      setStatus]      = useState('all')
  const [offset,      setOffset]      = useState(0)

  const load = useCallback(async (s: string, o: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(o) })
      if (s !== 'all') params.set('status', s)
      const r = await api.get(`/api/deployments?${params}`)
      if (r.ok) { const d = await r.json(); setDeployments(d.deployments); setTotal(d.total) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(status, offset) }, [load, status, offset])

  const setFilter = (s: string) => { setStatus(s); setOffset(0) }

  const pages = Math.ceil(total / LIMIT)
  const page  = Math.floor(offset / LIMIT)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">

      <div>
        <h1 className="text-2xl font-bold text-white">Deployments</h1>
        <p className="text-slate-500 text-sm mt-0.5">All deployments across all applications</p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
              status === s
                ? 'bg-sp-accent/15 text-sp-accent border border-sp-accent/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
        {total > 0 && (
          <span className="ml-auto text-[11px] text-slate-600">{total} deployment{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="sp-card p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-600 text-sm animate-pulse">Loading…</div>
        ) : deployments.length === 0 ? (
          <div className="py-12 text-center text-slate-600 text-sm">No deployments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-sp-border">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">App</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Server</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hidden md:table-cell">By</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Started</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hidden sm:table-cell">Duration</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-sp-border">
                {deployments.map(d => (
                  <tr key={d.id} className="hover:bg-sp-hover/50 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{d.app_name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{d.server_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_CFG[d.status] ?? 'bg-slate-700 text-slate-400'}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{d.deployed_by || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono">{fmtTime(d.started_at)}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono hidden sm:table-cell">{duration(d.started_at, d.finished_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/deployments/${d.id}`}
                        className="text-[10px] text-sp-accent hover:underline font-mono"
                      >
                        log →
                      </Link>
                    </td>
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
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function duration(start: string, end: string | null) {
  if (!end) return '–'
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

