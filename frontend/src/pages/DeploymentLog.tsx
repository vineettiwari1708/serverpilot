'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'

interface Deployment {
  id:          string
  app_id:      string
  app_name:    string
  server_name: string
  status:      string
  log:         string
  deployed_by: string | null
  started_at:  string
  finished_at: string | null
}

const STATUS_COLOR: Record<string, string> = {
  success:      'text-green-400',
  running:      'text-blue-400',
  health_check: 'text-yellow-400',
  failed:       'text-red-400',
  pending:      'text-slate-400',
}

const ACTIVE = new Set(['pending', 'running', 'health_check'])

export default function DeploymentLog() {
  const { id } = useParams<{ id: string }>()
  const [dep,     setDep]     = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  usePageTitle(dep ? `Deploy: ${dep.app_name}` : 'Deployment')
  const logRef = useRef<HTMLPreElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    try {
      const r = await api.get(`/api/deployments/${id}`)
      if (!r.ok) { setError('Deployment not found'); setLoading(false); return }
      const { deployment } = await r.json()
      setDep(deployment)
      setLoading(false)
      // Auto-scroll log to bottom
      setTimeout(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      }, 50)
      return deployment
    } catch {
      setError('Failed to load')
      setLoading(false)
    }
  }

  useEffect(() => {
    load().then(d => {
      if (d && ACTIVE.has(d.status)) {
        // Poll while deployment is active
        timerRef.current = setInterval(async () => {
          const updated = await load()
          if (updated && !ACTIVE.has(updated.status)) {
            if (timerRef.current) clearInterval(timerRef.current)
          }
        }, 3000)
      }
    })
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [id])

  if (loading) return <div className="p-6 text-slate-500">Loading…</div>
  if (error)   return <div className="p-6 text-red-400">{error}</div>
  if (!dep)    return null

  const isActive = ACTIVE.has(dep.status)
  const color = STATUS_COLOR[dep.status] || 'text-slate-400'

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/applications/${dep.app_id}`} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← {dep.app_name}
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-400 text-sm font-mono">{dep.id.slice(0, 8)}</span>
      </div>

      {/* Meta card */}
      <div className="sp-card grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Status</p>
          <p className={`text-sm font-semibold ${color} flex items-center gap-1.5`}>
            {isActive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
              </span>
            )}
            {dep.status.replace('_', ' ').toUpperCase()}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Server</p>
          <p className="text-sm font-mono text-slate-300">{dep.server_name}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Started</p>
          <p className="text-sm text-slate-400">{new Date(dep.started_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Finished</p>
          <p className="text-sm text-slate-400">{dep.finished_at ? new Date(dep.finished_at).toLocaleString() : '—'}</p>
        </div>
      </div>

      {/* Log */}
      <div className="sp-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sp-border flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deployment Log</h2>
          {isActive && (
            <span className="text-[11px] text-blue-400 animate-pulse">Live — polling every 3s</span>
          )}
        </div>
        <pre
          ref={logRef}
          className="p-4 text-xs font-mono text-slate-300 bg-black/30 overflow-auto max-h-[60vh] whitespace-pre-wrap"
        >
          {dep.log || '(no output yet)'}
        </pre>
      </div>

      {dep.deployed_by && (
        <p className="text-xs text-slate-600">Deployed by {dep.deployed_by}</p>
      )}
    </div>
  )
}
