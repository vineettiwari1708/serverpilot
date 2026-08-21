'use client'
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../services/api'

interface App {
  id:               string
  name:             string
  compose_yaml:     string
  health_check_url: string
  created_at:       string
  updated_at:       string
}

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
  const { id } = useParams<{ id: string }>()

  const [app,         setApp]         = useState<App | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [servers,     setServers]     = useState<Server[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  // edit state
  const [editing,      setEditing]      = useState(false)
  const [editYaml,     setEditYaml]     = useState('')
  const [editHealth,   setEditHealth]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')

  // deploy state
  const [deploying,    setDeploying]    = useState(false)
  const [deployServerId, setDeployServerId] = useState('')
  const [deployError,  setDeployError]  = useState('')

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
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Finished</th>
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
                  <td className="px-4 py-3 text-slate-500 text-xs">{d.finished_at ? new Date(d.finished_at).toLocaleString() : '—'}</td>
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
    </div>
  )
}
