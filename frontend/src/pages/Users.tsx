import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface User {
  id: string; name: string; email: string; role: string; created_at: string
}

interface Form { name: string; email: string; password: string; role: string }

export default function Users() {
  const { user: me } = useAuth()
  const [users,      setUsers]     = useState<User[]>([])
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState('')
  const [showForm,   setShowForm]  = useState(false)
  const [form,       setForm]      = useState<Form>({ name: '', email: '', password: '', role: 'viewer' })
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError] = useState('')

  const load = async () => {
    try {
      const r = await api.get('/api/users')
      if (!r.ok) { setError('Failed to load users'); return }
      const d = await r.json()
      setUsers(d.users)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const r = await api.post('/api/users', form)
      if (!r.ok) {
        const d = await r.json()
        setFormError(d.error || 'Failed to create user')
        return
      }
      setForm({ name: '', email: '', password: '', role: 'viewer' })
      setShowForm(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const changeRole = async (id: string, role: string) => {
    await api.put(`/api/users/${id}`, { role })
    await load()
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    await api.delete(`/api/users/${id}`)
    await load()
  }

  if (loading) return <div className="p-6 text-slate-600 text-sm animate-pulse">Loading…</div>

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">Admin-only access</p>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setFormError('') }}
          className="px-4 py-2 rounded-lg bg-sp-accent text-white text-xs font-semibold hover:bg-sp-accent/80 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Create form */}
      {showForm && (
        <form onSubmit={createUser} className="sp-card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Create User</h2>
          {formError && <p className="text-red-400 text-xs">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Name</label>
              <input
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Role</label>
              <select
                className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-1.5 rounded-lg bg-sp-accent text-white text-xs font-semibold disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {/* User list */}
      <div className="sp-card divide-y divide-sp-border">
        {users.length === 0 && (
          <p className="text-slate-600 text-sm py-6 text-center">No users found.</p>
        )}
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-4 py-3.5 flex-wrap">

            {/* Avatar */}
            <div className="h-8 w-8 rounded-full bg-sp-accent/20 border border-sp-accent/30 flex items-center justify-center text-sp-accent font-bold text-xs shrink-0">
              {u.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">
                {u.name}
                {u.id === me?.id && (
                  <span className="ml-2 text-[9px] font-bold text-sp-accent bg-sp-accent/10 border border-sp-accent/30 px-1.5 py-0.5 rounded uppercase">you</span>
                )}
              </p>
              <p className="text-xs text-slate-500 font-mono">{u.email}</p>
            </div>

            {/* Role selector / badge */}
            {u.id === me?.id ? (
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded border border-slate-700 text-slate-500">
                {u.role}
              </span>
            ) : (
              <select
                value={u.role}
                onChange={e => changeRole(u.id, e.target.value)}
                className="bg-sp-hover border border-sp-border rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-sp-accent"
              >
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            )}

            {/* Delete */}
            {u.id !== me?.id && (
              <button
                onClick={() => deleteUser(u.id)}
                className="text-[10px] font-mono text-red-500/40 hover:text-red-400 transition-colors"
              >
                delete
              </button>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
