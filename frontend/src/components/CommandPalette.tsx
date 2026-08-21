import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

interface Result {
  id:    string
  label: string
  sub:   string
  type:  'server' | 'app'
  href:  string
}

interface Props {
  open:    boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate   = useNavigate()
  const inputRef   = useRef<HTMLInputElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [all,     setAll]     = useState<Result[]>([])
  const [cursor,  setCursor]  = useState(0)
  const [loading, setLoading] = useState(false)

  // Load all servers + apps once when palette opens
  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    setLoading(true)
    Promise.all([
      api.get('/api/servers').then(r => r.ok ? r.json() : null),
      api.get('/api/apps').then(r => r.ok ? r.json() : null),
    ]).then(([srv, apps]) => {
      const items: Result[] = []
      for (const s of (srv?.servers ?? [])) {
        items.push({ id: s.id, label: s.name, sub: s.hostname || s.ip || '', type: 'server', href: `/servers/${s.id}` })
      }
      for (const a of (apps?.apps ?? [])) {
        items.push({ id: a.id, label: a.name, sub: a.last_server || 'no deployments', type: 'app', href: `/applications/${a.id}` })
      }
      setAll(items)
      setResults(items)
    }).finally(() => setLoading(false))
  }, [open])

  // Filter as query changes
  useEffect(() => {
    if (!query.trim()) { setResults(all); setCursor(0); return }
    const q = query.toLowerCase()
    setResults(all.filter(r => r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)))
    setCursor(0)
  }, [query, all])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  // Scroll cursor item into view
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const go = useCallback((r: Result) => {
    onClose()
    navigate(r.href)
  }, [navigate, onClose])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) go(results[cursor])
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-sp-surface border border-sp-border rounded-xl shadow-2xl overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-sp-border">
          <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search servers, apps…"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-slate-700 border border-sp-border rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-72">
          {loading && (
            <div className="px-4 py-8 text-center text-slate-600 text-sm animate-pulse">Loading…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-600 text-sm">No results for "{query}"</div>
          )}
          {!loading && results.map((r, i) => (
            <div
              key={r.id + r.type}
              onMouseDown={() => go(r)}
              onMouseEnter={() => setCursor(i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                i === cursor ? 'bg-sp-accent/10' : 'hover:bg-sp-hover'
              }`}
            >
              <TypeBadge type={r.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{r.label}</p>
                <p className="text-[11px] text-slate-600 truncate font-mono">{r.sub}</p>
              </div>
              {i === cursor && (
                <kbd className="text-[10px] text-slate-700 border border-sp-border rounded px-1.5 py-0.5 font-mono shrink-0">↵</kbd>
              )}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-sp-border flex items-center gap-4 text-[10px] text-slate-700">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
            <span className="ml-auto">{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: 'server' | 'app' }) {
  if (type === 'server') return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-blue-500/30 text-blue-400 bg-blue-500/10 shrink-0">
      Server
    </span>
  )
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-400 bg-purple-500/10 shrink-0">
      App
    </span>
  )
}
