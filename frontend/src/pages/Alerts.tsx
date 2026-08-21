'use client'
import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface Alert {
  id:              string
  server_id:       string
  server_name:     string
  metric:          string
  value:           number
  threshold:       number
  severity:        'warning' | 'critical'
  status:          'open' | 'acknowledged' | 'resolved'
  message:         string
  created_at:      string
  acknowledged_at: string | null
  resolved_at:     string | null
}

const SEV_COLOR = {
  critical: 'text-red-400 bg-red-500/10 ring-red-500/30',
  warning:  'text-yellow-400 bg-yellow-500/10 ring-yellow-500/30',
}

const STATUS_COLOR = {
  open:         'text-red-400',
  acknowledged: 'text-yellow-400',
  resolved:     'text-green-400',
}

const METRIC_LABEL: Record<string, string> = {
  cpu_pct:       'CPU',
  ram_pct:       'RAM',
  disk_pct:      'Disk',
  heartbeat_age: 'Heartbeat',
}

export default function Alerts() {
  const [alerts,  setAlerts]  = useState<Alert[]>([])
  const [counts,  setCounts]  = useState({ open: 0, acknowledged: 0 })
  const [filter,  setFilter]  = useState<'active' | 'resolved' | 'all'>('active')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const status = filter === 'active' ? '' : filter === 'resolved' ? 'resolved' : 'all'
    const q = status ? `?status=${status}` : ''
    const r = await api.get(`/api/alerts${q}`)
    if (r.ok) {
      const d = await r.json()
      setAlerts(d.alerts)
      setCounts(d.counts)
    }
    setLoading(false)
  }

  useEffect(() => { setLoading(true); load() }, [filter])
  useEffect(() => {
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [filter])

  const acknowledge = async (id: string) => {
    await api.post(`/api/alerts/${id}/acknowledge`, {})
    load()
  }

  const resolve = async (id: string) => {
    await api.post(`/api/alerts/${id}/resolve`, {})
    load()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {counts.open > 0 && (
              <span className="text-red-400 font-medium">{counts.open} open</span>
            )}
            {counts.open > 0 && counts.acknowledged > 0 && <span className="text-slate-600"> · </span>}
            {counts.acknowledged > 0 && (
              <span className="text-yellow-400 font-medium">{counts.acknowledged} acknowledged</span>
            )}
            {counts.open === 0 && counts.acknowledged === 0 && (
              <span className="text-green-400">All clear</span>
            )}
          </p>
        </div>
        <span className="text-[10px] text-slate-700 font-mono">polls every 30s</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-sp-border">
        {(['active', 'resolved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              filter === f ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sp-card text-center text-slate-500 py-10">Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="sp-card text-center py-12">
          <p className="text-green-400 text-sm font-medium">
            {filter === 'active' ? '✓ No active alerts' : 'No alerts found'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className={`sp-card border-l-2 ${
              a.severity === 'critical' ? 'border-l-red-500' : 'border-l-yellow-500'
            }`}>
              <div className="flex items-start gap-4">
                {/* Severity badge */}
                <span className={`mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ring-1 ${SEV_COLOR[a.severity]}`}>
                  {a.severity.toUpperCase()}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{a.message}</p>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <span className="text-[11px] text-slate-500 font-mono">{a.server_name}</span>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-500">{METRIC_LABEL[a.metric] || a.metric}</span>
                    <span className="text-[11px] text-slate-600">·</span>
                    <span className="text-[11px] text-slate-600">{new Date(a.created_at).toLocaleString()}</span>
                    {a.resolved_at && (
                      <>
                        <span className="text-[11px] text-slate-600">·</span>
                        <span className="text-[11px] text-green-600">resolved {new Date(a.resolved_at).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status + actions */}
                <div className="shrink-0 flex items-center gap-3">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${STATUS_COLOR[a.status]}`}>
                    {a.status}
                  </span>
                  {a.status === 'open' && (
                    <button onClick={() => acknowledge(a.id)}
                      className="text-xs text-slate-500 hover:text-yellow-400 transition-colors">
                      Ack
                    </button>
                  )}
                  {(a.status === 'open' || a.status === 'acknowledged') && (
                    <button onClick={() => resolve(a.id)}
                      className="text-xs text-slate-500 hover:text-green-400 transition-colors">
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
