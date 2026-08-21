import { useEffect, useState } from 'react'
import { api } from '../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Server { id: string; name: string; status: string }

interface Thresholds {
  cpu_warn: number; cpu_crit: number
  ram_warn: number; ram_crit: number
  disk_warn: number; disk_crit: number
  offline_min: number
}

interface Channel {
  id: string; name: string; type: string; url: string
  enabled: boolean; on_warning: boolean; on_critical: boolean; on_offline: boolean
  created_at: string
}

const DEFAULTS: Thresholds = {
  cpu_warn: 80, cpu_crit: 90,
  ram_warn: 80, ram_crit: 90,
  disk_warn: 80, disk_crit: 90,
  offline_min: 5,
}

type Tab = 'thresholds' | 'notifications'

// ── Component ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState<Tab>('thresholds')

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">System configuration</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-sp-border -mb-2">
        {(['thresholds', 'notifications'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              tab === t
                ? 'text-sp-accent border-sp-accent'
                : 'text-slate-500 hover:text-slate-300 border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'thresholds'   && <ThresholdsTab />}
      {tab === 'notifications' && <NotificationsTab />}
    </div>
  )
}

// ── Thresholds tab ────────────────────────────────────────────────────────────

function ThresholdsTab() {
  const [servers,    setServers]    = useState<Server[]>([])
  const [selected,   setSelected]   = useState<string>('')
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULTS)
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    api.get('/api/servers')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.servers?.length) {
          setServers(d.servers)
          setSelected(d.servers[0].id)
        }
      })
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    api.get(`/api/server-thresholds/${selected}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setThresholds(d) })
      .finally(() => setLoading(false))
  }, [selected])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const r = await api.put(`/api/server-thresholds/${selected}`, thresholds)
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError((d as {error?:string}).error || 'Failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const numField = (key: keyof Thresholds, label: string, max = 100) => (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input type="number" min={0} max={max}
        className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
        value={thresholds[key]}
        onChange={e => setThresholds(t => ({ ...t, [key]: Number(e.target.value) }))} />
    </div>
  )

  if (servers.length === 0) return (
    <div className="sp-card text-center py-10 text-slate-500 text-sm">
      No servers registered yet.
    </div>
  )

  return (
    <>
      <div className="sp-card">
        <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Server</label>
        <select
          className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
          value={selected}
          onChange={e => { setSelected(e.target.value); setSaved(false) }}
        >
          {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-slate-600 text-sm animate-pulse">Loading…</div>
      ) : (
        <form onSubmit={save} className="sp-card space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Alert Thresholds</h2>
          <p className="text-[11px] text-slate-600 -mt-3">Percentages. Warning fires first; Critical fires at a higher level.</p>

          <div><p className="text-xs font-semibold text-slate-400 mb-3">CPU</p>
            <div className="grid grid-cols-2 gap-4">{numField('cpu_warn','Warning (%)')}{numField('cpu_crit','Critical (%)')}</div></div>

          <div><p className="text-xs font-semibold text-slate-400 mb-3">RAM</p>
            <div className="grid grid-cols-2 gap-4">{numField('ram_warn','Warning (%)')}{numField('ram_crit','Critical (%)')}</div></div>

          <div><p className="text-xs font-semibold text-slate-400 mb-3">Disk</p>
            <div className="grid grid-cols-2 gap-4">{numField('disk_warn','Warning (%)')}{numField('disk_crit','Critical (%)')}</div></div>

          <div><p className="text-xs font-semibold text-slate-400 mb-3">Offline Detection</p>
            <div className="grid grid-cols-2 gap-4">{numField('offline_min','Minutes without heartbeat', 60)}</div></div>

          <div className="flex items-center justify-between pt-2 border-t border-sp-border">
            <div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {saved && <p className="text-green-400 text-xs">Saved!</p>}
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2 rounded-lg bg-sp-accent text-white text-xs font-semibold disabled:opacity-50 hover:bg-sp-accent/80 transition-colors">
              {saving ? 'Saving…' : 'Save Thresholds'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}

// ── Notifications tab ─────────────────────────────────────────────────────────

interface ChannelForm { name: string; type: string; url: string; on_warning: boolean; on_critical: boolean; on_offline: boolean }

const BLANK_FORM: ChannelForm = { name: '', type: 'slack', url: '', on_warning: false, on_critical: true, on_offline: true }

function NotificationsTab() {
  const [channels,   setChannels]   = useState<Channel[]>([])
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState<ChannelForm>(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState('')
  const [testing,    setTesting]    = useState<string | null>(null)
  const [testMsg,    setTestMsg]    = useState<Record<string, string>>({})

  const load = async () => {
    const r = await api.get('/api/notification-channels')
    if (r.ok) { const d = await r.json(); setChannels(d.channels) }
  }

  useEffect(() => { load() }, [])

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const r = await api.post('/api/notification-channels', form)
      if (!r.ok) { const d = await r.json(); setFormError(d.error || 'Failed'); return }
      setForm(BLANK_FORM)
      setShowForm(false)
      await load()
    } finally { setSubmitting(false) }
  }

  const toggleEnabled = async (ch: Channel) => {
    await api.put(`/api/notification-channels/${ch.id}`, { enabled: !ch.enabled })
    await load()
  }

  const deleteChannel = async (id: string) => {
    if (!confirm('Delete this notification channel?')) return
    await api.delete(`/api/notification-channels/${id}`)
    await load()
  }

  const testChannel = async (id: string) => {
    setTesting(id)
    setTestMsg(m => ({ ...m, [id]: '' }))
    try {
      const r = await api.post(`/api/notification-channels/${id}/test`, {})
      const d = await r.json()
      setTestMsg(m => ({ ...m, [id]: r.ok ? 'Sent!' : (d.error || `HTTP ${d.status}`) }))
    } catch {
      setTestMsg(m => ({ ...m, [id]: 'Network error' }))
    } finally {
      setTesting(null)
      setTimeout(() => setTestMsg(m => ({ ...m, [id]: '' })), 5000)
    }
  }

  const toggle = (key: keyof ChannelForm) =>
    setForm(f => ({ ...f, [key]: !f[key as 'on_warning'] }))

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-600">
          Send alerts to Slack or a custom webhook when critical events fire.
        </p>
        <button
          onClick={() => { setShowForm(s => !s); setFormError('') }}
          className="px-4 py-1.5 rounded-lg bg-sp-accent text-white text-xs font-semibold hover:bg-sp-accent/80 transition-colors shrink-0"
        >
          {showForm ? 'Cancel' : '+ Add Channel'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createChannel} className="sp-card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">New Channel</h2>
          {formError && <p className="text-red-400 text-xs">{formError}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Name</label>
              <input className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Type</label>
              <select className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
              {form.type === 'slack' ? 'Slack Webhook URL' : 'Webhook URL'}
            </label>
            <input type="url"
              className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent font-mono"
              placeholder={form.type === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://…'}
              value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required />
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Notify on</p>
            {([['on_warning','Warning'], ['on_critical','Critical'], ['on_offline','Offline']] as const).map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-sp-accent w-3.5 h-3.5"
                  checked={form[k]} onChange={() => toggle(k)} />
                <span className="text-xs text-slate-400">{lbl}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-slate-500 hover:text-slate-300">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-5 py-1.5 rounded-lg bg-sp-accent text-white text-xs font-semibold disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Channel'}
            </button>
          </div>
        </form>
      )}

      {/* Channel list */}
      <div className="sp-card divide-y divide-sp-border">
        {channels.length === 0 && (
          <p className="text-slate-600 text-sm py-6 text-center">No notification channels configured.</p>
        )}
        {channels.map(ch => (
          <div key={ch.id} className="py-4 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`h-2 w-2 rounded-full shrink-0 ${ch.enabled ? 'bg-green-400' : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{ch.name}</p>
                <p className="text-[11px] text-slate-600 font-mono truncate">{ch.url}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                ch.type === 'slack' ? 'border-purple-500/30 text-purple-400' : 'border-blue-500/30 text-blue-400'
              }`}>{ch.type}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => testChannel(ch.id)} disabled={testing === ch.id}
                  className="text-[10px] text-slate-500 hover:text-slate-300 border border-sp-border rounded px-2 py-0.5 disabled:opacity-40">
                  {testing === ch.id ? '…' : 'test'}
                </button>
                <button onClick={() => toggleEnabled(ch)}
                  className={`text-[10px] border rounded px-2 py-0.5 transition-colors ${
                    ch.enabled
                      ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                      : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                  }`}>
                  {ch.enabled ? 'disable' : 'enable'}
                </button>
                <button onClick={() => deleteChannel(ch.id)}
                  className="text-[10px] text-red-500/40 hover:text-red-400 transition-colors font-mono">
                  delete
                </button>
              </div>
            </div>

            {testMsg[ch.id] && (
              <p className={`text-[10px] ml-5 ${testMsg[ch.id] === 'Sent!' ? 'text-green-400' : 'text-red-400'}`}>
                {testMsg[ch.id]}
              </p>
            )}

            <div className="flex items-center gap-4 ml-5 flex-wrap">
              {[['on_warning','Warning'], ['on_critical','Critical'], ['on_offline','Offline']].map(([k, lbl]) => (
                <span key={k} className={`text-[10px] ${(ch as Record<string, unknown>)[k] ? 'text-slate-400' : 'text-slate-700 line-through'}`}>
                  {lbl}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
