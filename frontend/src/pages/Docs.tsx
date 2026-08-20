import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { phases, type Phase, type Section } from '../data/phases'

const statusConfig = {
  done:     { label: 'DONE',     cls: 'bg-green-500/15 text-green-400 border-green-500/30'  },
  next:     { label: 'NEXT',     cls: 'bg-blue-500/15  text-blue-400  border-blue-500/30'   },
  upcoming: { label: 'UPCOMING', cls: 'bg-slate-700    text-slate-400 border-slate-600'     },
}

export default function Docs() {
  const { phaseId } = useParams<{ phaseId: string }>()
  const navigate    = useNavigate()

  const active = phases.find(p => p.id === phaseId) ?? phases[0]

  return (
    <div className="flex h-full">

      {/* ── Left panel — phase list ─────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-sp-border overflow-y-auto py-4 px-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-3">
          Build Phases
        </p>
        {phases.map(p => {
          const isActive = p.id === active.id
          const cfg = statusConfig[p.status]
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/docs/${p.id}`)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3 ${
                isActive
                  ? 'bg-sp-accent/15 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-sp-hover'
              }`}
            >
              {/* Phase badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${cfg.cls}`}>
                {p.status === 'done' ? '✓' : p.id.toUpperCase()}
              </span>
              <span className="text-sm truncate">{p.title}</span>
            </button>
          )
        })}
      </aside>

      {/* ── Right panel — content ───────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl">
        <PhaseDoc phase={active} />
      </main>

    </div>
  )
}

// ── Phase document renderer ───────────────────────────────────────────────────

function PhaseDoc({ phase }: { phase: Phase }) {
  const cfg = statusConfig[phase.status]
  return (
    <article className="space-y-5">

      {/* Header */}
      <div className="pb-5 border-b border-sp-border">
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
            Phase {phase.id.toUpperCase()} · {cfg.label}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">{phase.title}</h1>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">{phase.summary}</p>
      </div>

      {/* Body sections */}
      {phase.sections.map((s, i) => <RenderSection key={i} s={s} />)}

    </article>
  )
}

function RenderSection({ s }: { s: Section }) {
  switch (s.type) {
    case 'heading':
      return <h2 className="text-lg font-bold text-white mt-6 mb-2">{s.content}</h2>

    case 'subheading':
      return <h3 className="text-sm font-semibold text-slate-300 mt-4 mb-1.5">{s.content}</h3>

    case 'para':
      return <p className="text-slate-400 text-sm leading-relaxed">{s.content}</p>

    case 'divider':
      return <hr className="border-sp-border my-2" />

    case 'list':
      return (
        <ul className="space-y-1.5 pl-1">
          {s.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sp-accent shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )

    case 'code':
      return <CodeBlock lang={s.lang ?? 'text'} code={s.content ?? ''} />

    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-sp-border">
          <table className="w-full text-sm">
            <thead className="bg-sp-hover border-b border-sp-border">
              <tr>
                {s.headers?.map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sp-border">
              {s.rows?.map((row, i) => (
                <tr key={i} className="hover:bg-sp-hover/50">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'text-slate-200 font-mono text-xs' : 'text-slate-400 text-xs'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'note':
      return (
        <div className="flex gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
          <span className="text-blue-400 text-sm shrink-0 mt-0.5">ℹ</span>
          <p className="text-blue-300 text-sm leading-relaxed">{s.content}</p>
        </div>
      )

    case 'warning':
      return (
        <div className="flex gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <span className="text-amber-400 text-sm shrink-0 mt-0.5">⚠</span>
          <p className="text-amber-300 text-sm leading-relaxed">{s.content}</p>
        </div>
      )

    default:
      return null
  }
}

// ── Code block with copy button ───────────────────────────────────────────────

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-xl border border-sp-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-sp-hover border-b border-sp-border">
        <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{lang}</span>
        <button
          onClick={copy}
          className="text-[10px] font-medium text-slate-600 hover:text-slate-300 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed bg-sp-bg">
        <code>{code}</code>
      </pre>
    </div>
  )
}
