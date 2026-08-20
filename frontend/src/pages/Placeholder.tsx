interface Props {
  title: string
  desc:  string
}

export default function Placeholder({ title, desc }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="h-16 w-16 rounded-2xl bg-sp-surface border border-sp-border flex items-center justify-center">
        <svg className="h-7 w-7 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">{desc}</p>
      </div>
    </div>
  )
}
