'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'

interface BackupJob {
  id:          string
  server_id:   string
  server_name: string
  type:        string
  direction:   string
  target:      string
  backup_dir:  string
  source_file: string
  status:      string
  file_path:   string
  size_bytes:  number
  checksum:    string
  log:         string
  triggered_by: string | null
  created_at:  string
  finished_at: string | null
}

const STATUS_COLOR: Record<string, string> = {
  success: 'text-green-400',
  running: 'text-blue-400',
  pending: 'text-slate-400',
  failed:  'text-red-400',
}

const ACTIVE = new Set(['pending', 'running'])

function fmtSize(b: number) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function BackupDetail() {
  const { id } = useParams<{ id: string }>()
  const [job,     setJob]     = useState<BackupJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // restore modal
  const [showRestore, setShowRestore] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [restoring,   setRestoring]   = useState(false)
  const [restoreErr,  setRestoreErr]  = useState('')

  const logRef   = useRef<HTMLPreElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    try {
      const r = await api.get(`/api/backups/${id}`)
      if (!r.ok) { setError('Job not found'); setLoading(false); return }
      const { job: j } = await r.json()
      setJob(j)
      setLoading(false)
      setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 50)
      return j
    } catch {
      setError('Failed to load')
      setLoading(false)
    }
  }

  useEffect(() => {
    load().then(j => {
      if (j && ACTIVE.has(j.status)) {
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

  const handleRestore = async () => {
    if (confirmText !== 'CONFIRM') return
    setRestoring(true); setRestoreErr('')
    try {
      const r = await api.post(`/api/backups/${id}/restore`, { confirm: 'CONFIRM' })
      const d = await r.json()
      if (!r.ok) { setRestoreErr(d.error || 'Failed'); setRestoring(false); return }
      setShowRestore(false)
      setConfirmText('')
    } catch {
      setRestoreErr('Network error')
    } finally {
      setRestoring(false)
    }
  }

  if (loading) return <div className="p-4 md:p-6 text-slate-500">Loading…</div>
  if (error)   return <div className="p-4 md:p-6 text-red-400">{error}</div>
  if (!job)    return null

  const isActive = ACTIVE.has(job.status)
  const color    = STATUS_COLOR[job.status] || 'text-slate-400'
  const isBackup = job.direction === 'backup'

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/backups" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Backups</Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-400 text-sm font-mono">{job.id.slice(0, 8)}</span>
        <span className="text-slate-700 text-xs ml-1 font-medium uppercase tracking-wider">
          {job.direction}
        </span>
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
            {job.status.toUpperCase()}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Server</p>
          <p className="text-sm font-mono text-slate-300">{job.server_name}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Type</p>
          <p className="text-sm text-slate-400">{job.type} ({job.direction})</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Size</p>
          <p className="text-sm text-slate-400">{fmtSize(job.size_bytes)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Target</p>
          <p className="text-sm font-mono text-slate-400 truncate">{job.target}</p>
        </div>
        {job.file_path && (
          <div className="md:col-span-2">
            <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">File Path</p>
            <p className="text-sm font-mono text-slate-400 truncate">{job.file_path}</p>
          </div>
        )}
        {job.checksum && (
          <div className="md:col-span-4">
            <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">SHA256</p>
            <p className="text-xs font-mono text-slate-600 truncate">{job.checksum}</p>
          </div>
        )}
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Started</p>
          <p className="text-sm text-slate-400">{new Date(job.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-600 uppercase tracking-wider mb-1">Finished</p>
          <p className="text-sm text-slate-400">{job.finished_at ? new Date(job.finished_at).toLocaleString() : '—'}</p>
        </div>
      </div>

      {/* Restore button — only for successful backups */}
      {isBackup && job.status === 'success' && (
        <div className="sp-card flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300 font-medium">Restore from this backup</p>
            <p className="text-xs text-slate-600 mt-0.5">This will overwrite existing data on {job.server_name}. Cannot be undone.</p>
          </div>
          <button onClick={() => setShowRestore(true)}
            className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium transition-colors">
            Restore…
          </button>
        </div>
      )}

      {/* Restore confirm modal */}
      {showRestore && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-sp-card border border-sp-border rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">Confirm Restore</h2>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300 space-y-1">
              <p className="font-semibold">⚠ This will overwrite existing data</p>
              <p className="text-red-400 text-xs">Server: {job.server_name} · Type: {job.type} · Target: {job.target}</p>
            </div>
            {restoreErr && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{restoreErr}</p>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Type <span className="font-mono text-white">CONFIRM</span> to proceed</label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="CONFIRM"
                autoFocus
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRestore}
                disabled={confirmText !== 'CONFIRM' || restoring}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {restoring ? 'Restoring…' : 'Restore Now'}
              </button>
              <button onClick={() => { setShowRestore(false); setConfirmText(''); setRestoreErr('') }}
                className="px-4 py-2 rounded-lg bg-sp-hover border border-sp-border text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log */}
      <div className="sp-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sp-border flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Log</h2>
          {isActive && <span className="text-[11px] text-blue-400 animate-pulse">Live — polling every 3s</span>}
        </div>
        <pre ref={logRef}
          className="p-4 text-xs font-mono text-slate-300 bg-black/30 overflow-auto max-h-[50vh] whitespace-pre-wrap">
          {job.log || '(no output yet)'}
        </pre>
      </div>

      {job.triggered_by && (
        <p className="text-xs text-slate-600">Triggered by {job.triggered_by}</p>
      )}
    </div>
  )
}

