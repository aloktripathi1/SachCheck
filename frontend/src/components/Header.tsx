import { ShieldCheck, Sparkles, Github } from 'lucide-react'
import type { AppView } from '../types'

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5">
      <span className="relative grid h-[38px] w-[38px] place-items-center rounded-xl bg-gradient-to-br from-[#4f8dfd] to-[#1e3a8a] shadow-[0_6px_18px_-6px_rgba(79,141,253,0.5)] ring-1 ring-inset ring-white/25">
        <ShieldCheck className="h-5 w-5 text-white" />
      </span>
      <span className="font-serif text-[19px] font-semibold tracking-tight text-slate-100">SachCheck</span>
    </button>
  )
}

export function Nav({ view, go }: { view: AppView; go: (v: AppView, demo?: boolean) => void }) {
  const links: { id: AppView; label: string; isNew?: boolean }[] = [
    { id: 'landing', label: 'Home' },
    { id: 'analyze', label: 'Analyze' },
    { id: 'image', label: 'Image Check', isNew: true },
  ]
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#020817]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center px-6 py-3.5">
        <div className="flex flex-1 items-center">
          <Logo onClick={() => go('landing')} />
        </div>
        <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {links.map((l) => (
            <button key={l.id} onClick={() => go(l.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${view === l.id ? 'bg-white/[0.06] text-slate-100' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'}`}>
              {l.label}
              {l.isNew && <span className="rounded border border-[#4f8dfd]/30 bg-[#4f8dfd]/10 px-1 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-[#4f8dfd]">NEW</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <a href="https://github.com/aloktripathi1/SachCheck" target="_blank" rel="noreferrer"
            className="hidden rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-100 sm:block">
            <Github className="h-[18px] w-[18px]" />
          </a>
          <button onClick={() => go('analyze')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4f8dfd] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_-10px_rgba(79,141,253,0.6)] ring-1 ring-inset ring-white/25 transition-colors hover:bg-[#6aa0ff]">
            <Sparkles className="h-[15px] w-[15px]" /> Analyze article
          </button>
        </div>
      </div>
    </nav>
  )
}
