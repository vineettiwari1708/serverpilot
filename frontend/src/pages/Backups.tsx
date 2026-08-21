'use client'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

interface BackupJob {
  id:          string
  server_id:   string
  server_name: string
  type:        string
  direction:   string
  target:      string
  status:      string
  file_path:   string
  size_bytes:  number
  triggered_by: string | null
  created_at:  string
  finished_at: string | null
}

interface Schedule {
  id:           string
  server_id:    string
  server_name:  string
  type:         string
  target:       string
  label:        string
  interval_min: number
  enabled:      boolean
  last_run:     string | null
  next_run:     string
}

interface Server { id: string; name: string }

const STATUS_COLOR: Record<string, string> = {
  success: 'text-green-400 bg-green-500/10 ring-green-500/30',
  running: 'text-blue-400  bg-blue-500/10  ring-blue-500/30',
  pending: 'text-slate-400 bg-slate-500/10 ring-slate-500/30',
  failed:  'text-red-400   bg-red-500/10   ring-red-500/30',
}

function fmtSize(b: number) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fmtInterval(min: number) {
  if (min < 60) return `${min}m`
  if (min < 1440) return `${min / 60}h`
  return `${min / 1440}d`
}

export default function Backups() {
  const [tab,       setTab]       = useState<'jobs' | 'schedules'>('jobs')
  const [jobs,      setJobs]      = useState<BackupJob[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [servers,   setServers]   = useState<Server[]>([])
  const [loading,   setLoading]   = useState(true)

  // create job form
  const [showJobForm, setShowJobForm] = useState(false)
  const [jServer, setJServer] = useState('')
  const [jType,   setJType]   = useState('postgres')
  const [jTarget, setJTarget] = useState('')
  const [jDir,    setJDir]    = useState('/opt/serverpilot/backups')
  const [jBusy,   setJBusy]   = useState(false)
  const [jErr,    setJErr]    = useState('')

  // create schedule form
  const [showSchedForm, setShowSchedForm] = useState(false)
  const [sServer,  setSServer]  = useState('')
  const [sType,    setSType]    = useState('postgres')
  const [sTarget,  setSTarget]  = useState('')
  const [sLabel,   setSLabel]   = useState('')
  const [sDir,     setSDir]     = useState('/opt/serverpilot/backups')
  const [sInterv,  setSInterv]  = useState('1440')
  const [sBusy,    setSBusy]    = useState(false)
  const [sErr,     setSErr]     = useState('')

  const load = async () => {
    const [jobsRes, schedRes, srvRes] = await Promise.all([
      api.get('/api/backups'),
      api.get('/api/backup-schedules'),
      api.get('/api/servers'),
    ])
    if (jobsRes.ok)  setJobs((await jobsRes.json()).jobs)
    if (schedRes.ok) setSchedules((await schedRes.json()).schedules)
    if (srvRes.ok)   setServers((await srvRes.json()).servers || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault()
    setJBusy(true); setJErr('')
    const r = await api.post('/api/backups', { server_id: jServer, type: jType, target: jTarget, backup_dir: jDir })
    const d = await r.json()
    if (!r.ok) { setJErr(d.error || 'Failed'); setJBusy(false); return }
    setShowJobForm(false); setJServer(''); setJTarget(''); setJBusy(false)
    load()
  }

  const createSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setSBusy(true); setSErr('')
    const r = await api.post('/api/backup-schedules', {
      server_id: sServer, type: sType, target: sTarget,
      label: sLabel, backup_dir: sDir, interval_min: parseInt(sInterv, 10),
    })
    const d = await r.json()
    if (!r.ok) { setSErr(d.error || 'Failed'); setSBusy(false); return }
    setShowSchedForm(false); setSServer(''); setSTarget(''); setSLabel(''); setSBusy(false)
    load()
  }

  const toggleSchedule = async (id: string, enabled: boolean) => {
    await api.patch(`/api/backup-schedules/${id}`, { enabled })
    load()
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    await api.delete(`/api/backup-schedules/${id}`)
    load()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Backups</h1>
          <p className="text-slate-500 text-sm mt-0.5">Backup jobs, schedules, and restore</p>
        </div>
        <div className="flex gap-2">
          {tab === 'jobs' && (
            <button onClick={() => setShowJobForm(v => !v)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
              {showJobForm ? 'Cancel' : '+ Manual Backup'}
            </button>
          )}
          {tab === 'schedules' && (
            <button onClick={() => setShowSchedForm(v => !v)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
              {showSchedForm ? 'Cancel' : '+ New Schedule'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-sp-border">
        {(['jobs', 'schedules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Jobs tab ── */}
      {tab === 'jobs' && (
        <>
          {showJobForm && (
            <form onSubmit={createJob} className="sp-card space-y-4">
              <h2 className="text-sm font-semibold text-slate-300">Manual Backup</h2>
              {jErr && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{jErr}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Server *</label>
                  <select value={jServer} onChange={e => setJServer(e.target.value)} required
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="">Select server…</option>
                    {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type *</label>
                  <select value={jType} onChange={e => setJType(e.target.value)}
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="postgres">PostgreSQL (pg_dump)</option>
                    <option value="files">Files (tar.gz)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {jType === 'postgres' ? 'Database URL or name *' : 'Path to backup *'}
                  </label>
                  <input value={jTarget} onChange={e => setJTarget(e.target.value)} required
                    placeholder={jType === 'postgres' ? 'postgres://user:pass@localhost/mydb' : '/var/data/myapp'}
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Backup Directory</label>
                  <input value={jDir} onChange={e => setJDir(e.target.value)}
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <button type="submit" disabled={jBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {jBusy ? 'Creating…' : 'Run Backup'}
              </button>
            </form>
          )}

          {loading ? (
            <div className="sp-card text-center text-slate-500 py-10">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="sp-card text-center py-12">
              <p className="text-slate-500 text-sm">No backup jobs yet.</p>
            </div>
          ) : (
            <div className="sp-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sp-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Server</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Target</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Size</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Started</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id} className="border-b border-sp-border last:border-0 hover:bg-sp-hover transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ring-1 ${STATUS_COLOR[j.status] || STATUS_COLOR.pending}`}>
                          {j.direction === 'restore' ? '↩ ' : ''}{j.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{j.server_name}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{j.type} {j.direction !== 'backup' ? `(${j.direction})` : ''}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[200px] truncate">{j.target}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{fmtSize(j.size_bytes)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/backups/${j.id}`} className="text-xs text-slate-500 hover:text-slate-200 transition-colors">Detail →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Schedules tab ── */}
      {tab === 'schedules' && (
        <>
          {showSchedForm && (
            <form onSubmit={createSchedule} className="sp-card space-y-4">
              <h2 className="text-sm font-semibold text-slate-300">New Backup Schedule</h2>
              {sErr && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{sErr}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Server *</label>
                  <select value={sServer} onChange={e => setSServer(e.target.value)} required
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="">Select server…</option>
                    {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type *</label>
                  <select value={sType} onChange={e => setSType(e.target.value)}
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="postgres">PostgreSQL</option>
                    <option value="files">Files</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Target *</label>
                  <input value={sTarget} onChange={e => setSTarget(e.target.value)} required
                    placeholder={sType === 'postgres' ? 'postgres://user:pass@localhost/mydb' : '/var/data/myapp'}
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Label</label>
                  <input value={sLabel} onChange={e => setSLabel(e.target.value)}
                    placeholder="daily db backup"
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Interval (minutes)</label>
                  <input type="number" min="1" value={sInterv} onChange={e => setSInterv(e.target.value)}
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                  <p className="text-[11px] text-slate-600 mt-1">1440 = daily · 720 = 12h · 60 = hourly</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Backup Directory</label>
                  <input value={sDir} onChange={e => setSDir(e.target.value)}
                    className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <button type="submit" disabled={sBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {sBusy ? 'Creating…' : 'Create Schedule'}
              </button>
            </form>
          )}

          {loading ? (
            <div className="sp-card text-center text-slate-500 py-10">Loading…</div>
          ) : schedules.length === 0 ? (
            <div className="sp-card text-center py-12">
              <p className="text-slate-500 text-sm">No schedules yet.</p>
            </div>
          ) : (
            <div className="sp-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sp-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Server</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Interval</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Next Run</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.id} className="border-b border-sp-border last:border-0 hover:bg-sp-hover transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-slate-200 text-sm">{s.label || s.target}</p>
                        {s.label && <p className="text-slate-600 text-[11px] font-mono truncate max-w-[200px]">{s.target}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{s.server_name}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{s.type}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{fmtInterval(s.interval_min)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(s.next_run).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => toggleSchedule(s.id, !s.enabled)}
                            className={`text-xs font-medium transition-colors ${s.enabled ? 'text-green-400 hover:text-red-400' : 'text-slate-600 hover:text-green-400'}`}>
                            {s.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button onClick={() => deleteSchedule(s.id)}
                            className="text-xs text-slate-600 hover:text-red-400 transition-colors">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
