import { ShieldCheck, Github, ExternalLink, Check } from 'lucide-react'
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

export function Footer({ go }: { go: (v: AppView) => void }) {
  return (
    <footer className="border-t border-white/[0.08] pb-10 pt-14">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Logo onClick={() => go('landing')} />
          <p className="mt-4 max-w-[320px] text-sm leading-relaxed text-slate-400">AI-powered claim-level fact verification. Every statement cross-examined against four independent sources — with a transparent evidence trail.</p>
          <div className="mt-5 flex gap-2.5">
            <a href="https://github.com/aloktripathi1/SachCheck" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-slate-400 hover:text-slate-100 transition-colors">
              <Github className="h-3 w-3" /> Open source
            </a>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-slate-400">
              <ExternalLink className="h-3 w-3" /> API docs
            </span>
          </div>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Methodology</h4>
          {['Claude Haiku — extraction', 'Google Fact Check API', 'Wikipedia REST', 'GDELT 2.0 coverage', 'ClaimBuster scoring', 'Claude Sonnet — synthesis'].map((t) => (
            <div key={t} className="flex items-center gap-2 py-1.5 text-[13.5px] text-slate-400">
              <span className="h-1 w-1 rounded-full bg-[#4f8dfd]" /> {t}
            </div>
          ))}
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Trust &amp; privacy</h4>
          {['Articles never stored', 'No user tracking', 'Transparent scoring', 'NewsGuard-compatible bands', 'GDPR-compatible'].map((t) => (
            <div key={t} className="flex items-center gap-2 py-1.5 text-[13.5px] text-slate-400">
              <Check className="h-3.5 w-3.5 text-emerald-400" /> {t}
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-11 flex max-w-[1200px] flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-6 pt-6">
        <span className="font-mono text-[11.5px] text-slate-500">SachCheck · Forensic claim verification · 2026</span>
        <span className="font-mono text-[11.5px] text-slate-500">सच — verify the truth, not the source</span>
      </div>
    </footer>
  )
}
