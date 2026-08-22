'use client'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'

interface App {
  id:               string
  name:             string
  health_check_url: string
  created_at:       string
  updated_at:       string
  last_status:      string | null
  last_deployed_at: string | null
  last_server:      string | null
}

const STATUS_COLOR: Record<string, string> = {
  success:      'text-green-400 bg-green-500/10 ring-green-500/30',
  running:      'text-blue-400  bg-blue-500/10  ring-blue-500/30',
  health_check: 'text-yellow-400 bg-yellow-500/10 ring-yellow-500/30',
  failed:       'text-red-400   bg-red-500/10   ring-red-500/30',
  pending:      'text-slate-400 bg-slate-500/10 ring-slate-500/30',
}

export default function Applications() {
  usePageTitle('Applications')
  const [apps,    setApps]    = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // create form
  const [showForm,       setShowForm]       = useState(false)
  const [creating,       setCreating]       = useState(false)
  const [createError,    setCreateError]    = useState('')
  const [name,           setName]           = useState('')
  const [healthCheckUrl, setHealthCheckUrl] = useState('')
  const [composeYaml,    setComposeYaml]    = useState(
`version: '3.9'
services:
  app:
    image: nginx:alpine
    ports:
      - "80:80"
    restart: unless-stopped`
  )

  const load = () =>
    api.get('/api/apps')
       .then(r => r.ok ? r.json() : Promise.reject())
       .then(d => { setApps(d.apps); setLoading(false) })
       .catch(() => { setError('Failed to load applications'); setLoading(false) })

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const r = await api.post('/api/apps', { name, compose_yaml: composeYaml, health_check_url: healthCheckUrl })
      const data = await r.json()
      if (!r.ok) { setCreateError(data.error || 'Create failed'); return }
      setShowForm(false)
      setName('')
      setHealthCheckUrl('')
      setComposeYaml('')
      load()
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage and deploy Docker Compose applications</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          {showForm ? 'Cancel' : '+ New App'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="sp-card space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Application</h2>
          {createError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{createError}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">App Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="my-app"
                required
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Health Check URL</label>
              <input
                value={healthCheckUrl}
                onChange={e => setHealthCheckUrl(e.target.value)}
                placeholder="http://localhost:80/health"
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Docker Compose YAML *</label>
            <textarea
              value={composeYaml}
              onChange={e => setComposeYaml(e.target.value)}
              rows={10}
              required
              className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {creating ? 'Creating…' : 'Create Application'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-sp-hover border border-sp-border text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Apps list */}
      {loading ? (
        <div className="sp-card text-center text-slate-500 py-10">Loading…</div>
      ) : error ? (
        <div className="sp-card text-center text-red-400 py-10">{error}</div>
      ) : apps.length === 0 ? (
        <div className="sp-card text-center py-12">
          <p className="text-slate-500 text-sm">No applications yet.</p>
          <p className="text-slate-600 text-xs mt-1">Click "New App" to create your first deployment.</p>
        </div>
      ) : (
        <div className="sp-card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sp-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Deploy</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Server</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} className="border-b border-sp-border last:border-0 hover:bg-sp-hover transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-200">{app.name}</span>
                    {app.health_check_url && (
                      <p className="text-[11px] text-slate-600 truncate max-w-[200px]">{app.health_check_url}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {app.last_deployed_at ? new Date(app.last_deployed_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{app.last_server || '—'}</td>
                  <td className="px-4 py-3">
                    {app.last_status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ring-1 ${STATUS_COLOR[app.last_status] || STATUS_COLOR.pending}`}>
                        {app.last_status.replace('_', ' ').toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-slate-700 text-xs">Never deployed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/applications/${app.id}`}
                      className="text-xs text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

