import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface Server { id: string; name: string; status: string }

interface Thresholds {
  cpu_warn:    number
  cpu_crit:    number
  ram_warn:    number
  ram_crit:    number
  disk_warn:   number
  disk_crit:   number
  offline_min: number
}

const DEFAULTS: Thresholds = {
  cpu_warn: 80, cpu_crit: 90,
  ram_warn: 80, ram_crit: 90,
  disk_warn: 80, disk_crit: 90,
  offline_min: 5,
}

export default function Settings() {
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
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setError('')
    api.get(`/api/server-thresholds/${selected}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setThresholds(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selected])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const r = await api.put(`/api/server-thresholds/${selected}`, thresholds)
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError((d as { error?: string }).error || 'Failed to save')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const numField = (key: keyof Thresholds, label: string, max = 100) => (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="number"
        min={0}
        max={max}
        className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
        value={thresholds[key]}
        onChange={e => setThresholds(t => ({ ...t, [key]: Number(e.target.value) }))}
      />
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Alert thresholds per server</p>
      </div>

      {servers.length === 0 ? (
        <div className="sp-card text-center py-10 text-slate-500 text-sm">
          No servers registered yet. Add a server to configure thresholds.
        </div>
      ) : (
        <>
          {/* Server picker */}
          <div className="sp-card">
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Server</label>
            <select
              className="w-full bg-sp-hover border border-sp-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sp-accent"
              value={selected}
              onChange={e => { setSelected(e.target.value); setSaved(false) }}
            >
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Threshold form */}
          {loading ? (
            <div className="text-slate-600 text-sm animate-pulse py-4">Loading thresholds…</div>
          ) : (
            <form onSubmit={save} className="sp-card space-y-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Alert Thresholds</h2>
              <p className="text-[11px] text-slate-600 -mt-3">
                Alerts fire at Warning; Critical triggers a higher-severity alert. Values are percentages.
              </p>

              <div>
                <p className="text-xs font-semibold text-slate-400 mb-3">CPU</p>
                <div className="grid grid-cols-2 gap-4">
                  {numField('cpu_warn', 'Warning (%)')}
                  {numField('cpu_crit', 'Critical (%)')}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 mb-3">RAM</p>
                <div className="grid grid-cols-2 gap-4">
                  {numField('ram_warn', 'Warning (%)')}
                  {numField('ram_crit', 'Critical (%)')}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 mb-3">Disk</p>
                <div className="grid grid-cols-2 gap-4">
                  {numField('disk_warn', 'Warning (%)')}
                  {numField('disk_crit', 'Critical (%)')}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 mb-3">Offline Detection</p>
                <div className="grid grid-cols-2 gap-4">
                  {numField('offline_min', 'Minutes without heartbeat', 60)}
                  <div className="flex items-end pb-2">
                    <p className="text-[11px] text-slate-600">
                      An alert fires when no heartbeat is received for this many minutes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-sp-border">
                <div>
                  {error  && <p className="text-red-400 text-xs">{error}</p>}
                  {saved  && <p className="text-green-400 text-xs">Thresholds saved!</p>}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-sp-accent text-white text-xs font-semibold disabled:opacity-50 hover:bg-sp-accent/80 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Thresholds'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
}
