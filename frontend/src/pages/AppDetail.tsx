import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

interface App {
  id:               string
  name:             string
  compose_yaml:     string
  health_check_url: string
  env_vars:         Record<string, string>
  created_at:       string
  updated_at:       string
}

type EnvRow = { key: string; value: string; revealed: boolean }

interface Deployment {
  id:          string
  server_id:   string
  server_name: string
  status:      string
  deployed_by: string | null
  started_at:  string
  finished_at: string | null
}

interface Server {
  id:   string
  name: string
}

const STATUS_COLOR: Record<string, string> = {
  success:      'text-green-400 bg-green-500/10 ring-green-500/30',
  running:      'text-blue-400  bg-blue-500/10  ring-blue-500/30',
  health_check: 'text-yellow-400 bg-yellow-500/10 ring-yellow-500/30',
  failed:       'text-red-400   bg-red-500/10   ring-red-500/30',
  pending:      'text-slate-400 bg-slate-500/10 ring-slate-500/30',
}

export default function AppDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'

  usePageTitle(app?.name ?? 'Application')
  const [app,         setApp]         = useState<App | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [servers,     setServers]     = useState<Server[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  // compose edit state
  const [editing,      setEditing]      = useState(false)
  const [editYaml,     setEditYaml]     = useState('')
  const [editHealth,   setEditHealth]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')

  // env vars state
  const [envRows,   setEnvRows]   = useState<EnvRow[]>([])
  const [savingEnv, setSavingEnv] = useState(false)

  // deploy state
  const [deploying,      setDeploying]      = useState(false)
  const [deployServerId, setDeployServerId] = useState('')
  const [deployError,    setDeployError]    = useState('')

  // delete state
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      const [appRes, srvRes] = await Promise.all([
        api.get(`/api/apps/${id}`),
        api.get('/api/servers'),
      ])
      if (!appRes.ok) { setError('App not found'); setLoading(false); return }
      const { app: a, deployments: d } = await appRes.json()
      const { servers: sv } = await srvRes.json()
      setApp(a)
      setDeployments(d)
      setServers(sv || [])
      setEditYaml(a.compose_yaml)
      setEditHealth(a.health_check_url)
      setEnvRows(Object.entries(a.env_vars || {}).map(([k, v]) => ({ key: k, value: String(v), revealed: false })))
    } catch {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const r = await api.put(`/api/apps/${id}`, { compose_yaml: editYaml, health_check_url: editHealth })
      const data = await r.json()
      if (!r.ok) { setSaveError(data.error || 'Save failed'); return }
      setApp(data.app)
      setEditing(false)
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeploy = async () => {
    if (!deployServerId) return
    setDeploying(true)
    setDeployError('')
    try {
      const r = await api.post(`/api/apps/${id}/deploy`, { server_id: deployServerId })
      const data = await r.json()
      if (!r.ok) { setDeployError(data.error || 'Deploy failed'); setDeploying(false); return }
      load()
    } catch {
      setDeployError('Network error')
    } finally {
      setDeploying(false)
    }
  }

  const handleRollback = async (deploymentId: string) => {
    if (!confirm('Roll back to this deployment?')) return
    try {
      const r = await api.post(`/api/apps/${id}/rollback`, { deployment_id: deploymentId })
      const data = await r.json()
      if (!r.ok) { alert(data.error || 'Rollback failed'); return }
      load()
    } catch {
      alert('Network error')
    }
  }

  const handleSaveEnv = async () => {
    setSavingEnv(true)
    try {
      const env_vars = Object.fromEntries(
        envRows.filter(r => r.key.trim()).map(r => [r.key.trim(), r.value])
      )
      const r = await api.put(`/api/apps/${id}`, { env_vars })
      if (r.ok) { const data = await r.json(); setApp(data.app) }
    } finally { setSavingEnv(false) }
  }

  const handleDeleteApp = async () => {
    if (!confirm(`Delete "${app?.name}"?\n\nThis removes the app and all its deployment records. This cannot be undone.`)) return
    setDeleting(true)
    try {
      const r = await api.delete(`/api/apps/${id}`)
      if (r.ok) navigate('/applications', { replace: true })
    } finally { setDeleting(false) }
  }

  const addEnvRow    = () => setEnvRows(r => [...r, { key: '', value: '', revealed: true }])
  const removeEnvRow = (i: number) => setEnvRows(r => r.filter((_, j) => j !== i))
  const setEnvKey    = (i: number, key: string) => setEnvRows(r => r.map((row, j) => j === i ? { ...row, key } : row))
  const setEnvValue  = (i: number, value: string) => setEnvRows(r => r.map((row, j) => j === i ? { ...row, value } : row))
  const toggleReveal = (i: number) => setEnvRows(r => r.map((row, j) => j === i ? { ...row, revealed: !row.revealed } : row))

  if (loading) return <div className="p-6 text-slate-500">Loading…</div>
  if (error)   return <div className="p-6 text-red-400">{error}</div>
  if (!app)    return null

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/applications" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Apps</Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-xl font-bold text-white font-mono">{app.name}</h1>
      </div>

      {/* Deploy panel */}
      <div className="sp-card space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deploy</h2>
        {deployError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{deployError}</p>
        )}
        <div className="flex items-center gap-3">
          <select
            value={deployServerId}
            onChange={e => setDeployServerId(e.target.value)}
            className="flex-1 bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select server…</option>
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={handleDeploy}
            disabled={!deployServerId || deploying}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            {deploying ? 'Deploying…' : 'Deploy Now'}
          </button>
        </div>
      </div>

      {/* Compose YAML */}
      <div className="sp-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Compose YAML</h2>
          <button
            onClick={() => setEditing(v => !v)}
            className="text-xs text-slate-500 hover:text-slate-200 transition-colors"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-3">
            {saveError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{saveError}</p>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Health Check URL</label>
              <input
                value={editHealth}
                onChange={e => setEditHealth(e.target.value)}
                placeholder="http://localhost:80/health"
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <textarea
              value={editYaml}
              onChange={e => setEditYaml(e.target.value)}
              rows={14}
              required
              className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500 resize-y"
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-lg bg-sp-hover border border-sp-border text-slate-400 hover:text-slate-200 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {app.health_check_url && (
              <p className="text-xs text-slate-500">Health check: <span className="font-mono text-slate-400">{app.health_check_url}</span></p>
            )}
            <pre className="bg-sp-hover border border-sp-border rounded-lg p-4 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre">
              {app.compose_yaml}
            </pre>
          </>
        )}
      </div>

      {/* Environment variables */}
      <div className="sp-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Environment Variables</h2>
          <button onClick={addEnvRow}
            className="text-[10px] font-semibold text-sp-accent hover:underline">
            + Add Variable
          </button>
        </div>

        {envRows.length === 0 && (
          <p className="text-[11px] text-slate-600">
            No environment variables. Variables are written to a <code className="text-slate-500">.env</code> file and passed to docker compose at deploy time.
          </p>
        )}

        <div className="space-y-2">
          {envRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={row.key}
                onChange={e => setEnvKey(i, e.target.value)}
                placeholder="KEY"
                className="w-40 bg-sp-hover border border-sp-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sp-accent uppercase"
              />
              <input
                type={row.revealed ? 'text' : 'password'}
                value={row.value}
                onChange={e => setEnvValue(i, e.target.value)}
                placeholder="value"
                className="flex-1 bg-sp-hover border border-sp-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sp-accent"
              />
              <button onClick={() => toggleReveal(i)}
                className="text-[10px] text-slate-600 hover:text-slate-300 w-10 text-center">
                {row.revealed ? 'hide' : 'show'}
              </button>
              <button onClick={() => removeEnvRow(i)}
                className="text-[10px] text-red-500/40 hover:text-red-400 font-mono">
                ×
              </button>
            </div>
          ))}
        </div>

        {envRows.length > 0 && (
          <div className="flex justify-end pt-1">
            <button onClick={handleSaveEnv} disabled={savingEnv}
              className="px-4 py-1.5 rounded-lg bg-sp-accent text-white text-xs font-semibold disabled:opacity-50 hover:bg-sp-accent/80 transition-colors">
              {savingEnv ? 'Saving…' : 'Save Variables'}
            </button>
          </div>
        )}
      </div>

      {/* Deployment history */}
      <div className="sp-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sp-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deployment History</h2>
        </div>
        {deployments.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-600 text-sm">No deployments yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sp-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Server</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Started</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Duration</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {deployments.map(d => (
                <tr key={d.id} className="border-b border-sp-border last:border-0 hover:bg-sp-hover transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ring-1 ${STATUS_COLOR[d.status] || STATUS_COLOR.pending}`}>
                      {d.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{d.server_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(d.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono hidden sm:table-cell">{deployDuration(d.started_at, d.finished_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/deployments/${d.id}`}
                        className="text-xs text-slate-500 hover:text-slate-200 transition-colors"
                      >
                        Log →
                      </Link>
                      {d.status === 'success' && (
                        <button
                          onClick={() => handleRollback(d.id)}
                          className="text-xs text-slate-500 hover:text-yellow-400 transition-colors"
                        >
                          Rollback
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger zone */}
      {isAdmin && (
        <div className="sp-card border border-red-500/20">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-500/70 mb-4">Danger Zone</h2>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 font-medium">Delete Application</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Permanently removes this app and all its deployment records. Running containers on servers are not affected.
              </p>
            </div>
            <button onClick={handleDeleteApp} disabled={deleting}
              className="shrink-0 px-4 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors disabled:opacity-40">
              {deleting ? 'Deleting…' : 'Delete App'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

function deployDuration(start: string, end: string | null) {
  if (!end) return '–'
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
