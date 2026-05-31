import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ArrowRight, Shield, Check, CheckCircle2, AlertTriangle, XCircle,
  Search, Target, Globe, Scissors, Loader2, FlaskConical, Link2, FileText,
  Clock, Quote, ChevronDown, Fingerprint,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAnalysis } from '../hooks/useAnalysis'
import { useRecentChecks, titleFromInput, timeAgo } from '../hooks/useRecentChecks'
import type { AppView } from '../types'

const EASE = [0.2, 0.8, 0.2, 1] as const
const CARD = 'rounded-2xl border border-white/[0.08] bg-white/[0.02]'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500'

type VerdictType = 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverified'

const VERDICT_META: Record<VerdictType, { label: string; Icon: LucideIcon; text: string; badge: string; border: string; bar: string; dot: string }> = {
  true:         { label: 'True',         Icon: CheckCircle2,  text: 'text-emerald-400', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-400', dot: 'bg-emerald-400' },
  mostly_true:  { label: 'Mostly True',  Icon: CheckCircle2,  text: 'text-emerald-300', badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300', border: 'border-emerald-500/20', bar: 'bg-emerald-300', dot: 'bg-emerald-300' },
  mixed:        { label: 'Mixed',        Icon: AlertTriangle, text: 'text-amber-400',   badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',       border: 'border-amber-500/30',   bar: 'bg-amber-400',   dot: 'bg-amber-400'   },
  mostly_false: { label: 'Mostly False', Icon: AlertTriangle, text: 'text-orange-400',  badge: 'border-orange-500/30 bg-orange-500/10 text-orange-400',    border: 'border-orange-500/30',  bar: 'bg-orange-400',  dot: 'bg-orange-400'  },
  false:        { label: 'False',        Icon: XCircle,       text: 'text-rose-400',    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-400',          border: 'border-rose-500/30',    bar: 'bg-rose-400',    dot: 'bg-rose-400'    },
  unverified:   { label: 'Unverified',   Icon: Search,        text: 'text-slate-400',   badge: 'border-white/10 bg-white/[0.03] text-slate-400',           border: 'border-white/10',       bar: 'bg-slate-400',   dot: 'bg-slate-400'   },
}

const Ticks = () => (
  <>
    <span className="pointer-events-none absolute left-3 top-3 h-2.5 w-2.5 border-l border-t border-white/20" />
    <span className="pointer-events-none absolute bottom-3 right-3 h-2.5 w-2.5 border-b border-r border-white/20" />
  </>
)

const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Loader2 className={`${className} animate-spin text-[#4f8dfd]`} />
)

function VerdictBadge({ verdict }: { verdict: VerdictType }) {
  const m = VERDICT_META[verdict] ?? VERDICT_META.unverified
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${m.badge}`}>
      <m.Icon className="h-3 w-3" /> {m.label}
    </span>
  )
}

function Meter({ pct, verdict }: { pct: number; verdict: VerdictType }) {
  const bar = VERDICT_META[verdict]?.bar ?? 'bg-[#4f8dfd]'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div className={`h-full rounded-full ${bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: EASE }} />
    </div>
  )
}

function IconTile({ Icon, className = '', size = 'h-[46px] w-[46px]' }: { Icon: LucideIcon; className?: string; size?: string }) {
  return (
    <div className={`grid ${size} place-items-center rounded-xl border border-white/10 bg-white/[0.03] ${className}`}>
      <Icon className="h-5 w-5" />
    </div>
  )
}

function useCountUp(target: number, run: boolean, ms = 1100) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) { setV(0); return }
    let raf = 0
    let start: number | undefined
    const step = (t: number) => {
      if (start === undefined) start = t
      const p = Math.min(1, (t - start) / ms)
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const fb = window.setTimeout(() => setV(target), ms + 250)
    return () => { cancelAnimationFrame(raf); clearTimeout(fb) }
  }, [target, run, ms])
  return v
}

const DEMO_ARTICLE = "India's central bank has reportedly issued an emergency directive ordering all crypto exchanges to freeze user withdrawals with immediate effect. Officials claim over 15 million Indians now hold cryptocurrency, ranking the country third globally in adoption. The move follows the Supreme Court's landmark decision, which had lifted the banking ban on crypto in 2020. Analysts warn the freeze could wipe out billions in retail holdings overnight, though no formal gazette notification has been published."

const STEPS = [
  { id: 'extract',  label: 'Extracting claims',    Icon: Scissors },
  { id: 'evidence', label: 'Gathering evidence',   Icon: Globe    },
  { id: 'synth',    label: 'Synthesizing verdicts', Icon: Sparkles },
]

function RunStatus({ step }: { step: string }) {
  const stepMap: Record<string, number> = { extracting: 0, gathering: 1, scoring: 1, synthesizing: 2, complete: 3 }
  const stepIndex = stepMap[step] ?? 0
  const isDone = step === 'complete'

  return (
    <div className="flex flex-wrap gap-2.5">
      {STEPS.map((s, i) => {
        const done = isDone || i < stepIndex
        const active = !isDone && i === stepIndex
        const cls = done
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : active
          ? 'border-[#4f8dfd]/30 bg-[#4f8dfd]/10 text-[#4f8dfd]'
          : 'border-white/10 bg-white/[0.03] text-slate-500'
        return (
          <div key={s.id} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 font-mono text-xs ${cls}`}>
            {done ? <Check className="h-3 w-3" strokeWidth={2.4} /> : active ? <Spinner className="h-3 w-3" /> : <s.Icon className="h-3 w-3" />}
            {s.label}
          </div>
        )
      })}
    </div>
  )
}

function ClaimCard({ claim, index }: { claim: any; index: number }) {
  const [open, setOpen] = useState(false)
  const verdict = (claim.verdict ?? 'unverified') as VerdictType
  const m = VERDICT_META[verdict] ?? VERDICT_META.unverified
  const hasVerdict = !!claim.verdict

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-2xl border bg-white/[0.02] p-5 transition-colors ${hasVerdict ? m.border : 'border-white/[0.08]'}`}>
      <div className="flex gap-3.5">
        <div className="min-w-[26px] pt-1 font-mono text-xs text-slate-500">C{String(index + 1).padStart(2, '0')}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3.5">
            <p className="m-0 font-serif text-[15.5px] leading-snug text-slate-100">
              <Quote className="mr-1.5 inline h-[15px] w-[15px] -translate-y-0.5 opacity-35" />{claim.text}
            </p>
            <div className="min-w-[92px] text-right">
              {hasVerdict
                ? <VerdictBadge verdict={verdict} />
                : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10.5px] text-slate-400"><Spinner className="h-3 w-3" /> checking</span>}
            </div>
          </div>

          {hasVerdict && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="mt-4">
              <div className="mb-3.5 flex items-center gap-3">
                <span className="min-w-[78px] font-mono text-[11px] text-slate-500">confidence</span>
                <div className="flex-1"><Meter pct={(claim.confidence ?? 0) * 100} verdict={verdict} /></div>
                <span className={`font-mono text-[13px] font-semibold ${m.text}`}>{Math.round((claim.confidence ?? 0) * 100)}%</span>
              </div>

              {claim.explanation && (
                <>
                  <button onClick={() => setOpen((o) => !o)}
                    className="-ml-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12.5px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-100">
                    <Search className="h-3.5 w-3.5" /> {open ? 'Hide' : 'Show'} evidence &amp; signals
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {open && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="mb-3.5 text-[13.5px] leading-relaxed text-slate-400">{claim.explanation}</p>
                          {claim.sources && claim.sources.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {claim.sources.map((s: any) => (
                                <a key={s.url} href={s.url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-slate-300 hover:text-white transition-colors">
                                  <Fingerprint className="h-3 w-3" /> {s.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ScorePanel({ state }: { state: any }) {
  const isDone = state.step === 'complete'
  const score = useCountUp(state.articleScore?.score ?? 0, isDone)
  const band = state.articleScore?.band ?? 'MIXED'

  const bandMeta: Record<string, { verdict: any; label: string }> = {
    GREEN:  { verdict: 'true',  label: 'High credibility' },
    YELLOW: { verdict: 'mixed', label: 'Mixed credibility' },
    RED:    { verdict: 'false', label: 'Low credibility'  },
    MIXED:  { verdict: 'mixed', label: 'Mixed'            },
  }
  const bm = bandMeta[band] ?? bandMeta.MIXED
  const m = VERDICT_META[bm.verdict as VerdictType]

  if (state.step === 'idle') {
    return (
      <div className={`${CARD} px-7 py-12 text-center`}>
        <IconTile Icon={Target} className="mx-auto mb-4 text-slate-400" size="h-[54px] w-[54px]" />
        <h3 className="mb-2 text-base font-semibold text-slate-100">Article score</h3>
        <p className="text-[13.5px] leading-snug text-slate-500">A weighted credibility score will appear here once analysis completes.</p>
      </div>
    )
  }

  return (
    <div className={`relative ${CARD} p-7`}>
      <Ticks />
      <div className={`mb-5 ${EYEBROW}`}>Article credibility</div>
      <div className="flex items-baseline gap-2">
        <span className={`font-serif text-7xl font-medium leading-none ${isDone ? m.text : 'text-slate-600'}`}>{isDone ? score : '··'}</span>
        <span className="font-mono text-lg text-slate-500">/100</span>
      </div>
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className={`h-full rounded-full ${isDone ? m.bar : 'bg-[#4f8dfd]'}`}
            initial={{ width: 0 }} animate={{ width: `${isDone ? (state.articleScore?.score ?? 0) : state.progress}%` }}
            transition={{ duration: 1, ease: EASE }} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {isDone
          ? <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${m.badge}`}><m.Icon className="h-3 w-3" />{bm.label}</span>
          : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400"><Spinner className="h-3 w-3" /> analyzing…</span>}
        <span className="font-mono text-[11px] text-slate-500">{state.claims.length} claims</span>
      </div>

      {isDone && state.articleScore && (
        <>
          <div className="my-6 h-px bg-white/[0.08]" />
          <div className={`mb-3.5 ${EYEBROW}`}>Verdict breakdown</div>
          <div className="flex flex-col gap-2.5">
            {(['true', 'mostly_true', 'mixed', 'mostly_false', 'false', 'unverified'] as VerdictType[]).map((v) => {
              const count = state.articleScore?.claimBreakdown?.[v] ?? 0
              if (count === 0) return null
              return (
                <div key={v} className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-sm ${VERDICT_META[v].dot}`} />
                  <span className="flex-1 text-[13.5px] text-slate-400">{VERDICT_META[v].label}</span>
                  <span className={`font-mono text-sm font-semibold ${VERDICT_META[v].text}`}>{count}</span>
                </div>
              )
            })}
          </div>

          {state.articleScore.summary && (
            <>
              <div className="my-6 h-px bg-white/[0.08]" />
              <p className="text-[13px] leading-relaxed text-slate-400">{state.articleScore.summary}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function AnalyzePage({ autoRun }: { autoRun: boolean; go: (v: AppView) => void }) {
  const { state, analyze, reset } = useAnalysis()
  const { checks: recentChecks, add: addRecent } = useRecentChecks()
  const [tab, setTab] = useState<'url' | 'text'>('text')
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0
  const canSubmit = tab === 'url' ? input.trim().length > 8 : wordCount >= 5
  const isAnalyzing = ['extracting', 'gathering', 'scoring', 'synthesizing'].includes(state.step)
  const isComplete = state.step === 'complete'
  const isError = state.step === 'error'

  const handleSubmit = useCallback(() => {
    if (!canSubmit || isAnalyzing) return
    analyze(input.trim())
  }, [input, canSubmit, isAnalyzing, analyze])

  const handleReset = useCallback(() => {
    reset()
    setInput('')
  }, [reset])

  useEffect(() => {
    if (autoRun) {
      setInput(DEMO_ARTICLE)
      setTimeout(() => analyze(DEMO_ARTICLE), 350)
    }
  }, [autoRun])

  // Save to recent checks when analysis completes
  useEffect(() => {
    if (state.step === 'complete' && state.articleScore && input.trim()) {
      addRecent({
        title: titleFromInput(input),
        score: state.articleScore.score,
        band: state.articleScore.band as any,
      })
    }
  }, [state.step])

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-10">
      <div className="mb-7">
        <div className={`mb-2.5 ${EYEBROW}`}>Analyze · claim-level</div>
        <h1 className="font-serif text-[clamp(34px,4vw,48px)] font-medium tracking-tight text-slate-100">Analyze an article</h1>
        <p className="mt-2.5 text-base text-slate-400">Paste text or a URL · AI extracts claims · 4 sources cross-checked · verdicts in <span className="font-mono text-slate-100">~38s</span></p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr_320px]">
        {/* INPUT */}
        <div className={`${CARD} p-7 lg:sticky lg:top-[88px]`}>
          <div className="mb-4 flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {(['url', 'text'] as const).map((tb) => (
              <button key={tb} onClick={() => setTab(tb)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${tab === tb ? 'bg-white/[0.06] text-slate-100' : 'text-slate-400 hover:text-slate-100'}`}>
                {tb === 'url' ? <Link2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {tb === 'url' ? 'Paste URL' : 'Paste text'}
              </button>
            ))}
          </div>

          {tab === 'url' ? (
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="https://example.com/news-article"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[15px] text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-[#4f8dfd]/40 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#4f8dfd]/10" />
          ) : (
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Paste article text here… (50+ words recommended for accurate extraction)"
              className="min-h-[190px] w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[15px] leading-relaxed text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-[#4f8dfd]/40 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#4f8dfd]/10" />
          )}
          {tab === 'text' && <div className="mt-2 text-right font-mono text-[11px] text-slate-500">{wordCount} words</div>}

          <div className="mt-4 flex gap-2.5">
            <button onClick={handleSubmit} disabled={!canSubmit || isAnalyzing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4f8dfd] px-4 py-3 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-[#6aa0ff] disabled:cursor-not-allowed disabled:opacity-50">
              {isAnalyzing ? <><Loader2 className="h-[15px] w-[15px] animate-spin" /> Analyzing…</> : <><Sparkles className="h-4 w-4" /> Analyze <ArrowRight className="h-[15px] w-[15px]" /></>}
            </button>
            <button onClick={() => { setInput(DEMO_ARTICLE); setTimeout(() => analyze(DEMO_ARTICLE), 50) }} disabled={isAnalyzing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] font-semibold text-slate-100 transition-colors hover:border-white/20 disabled:opacity-50">
              <FlaskConical className="h-[15px] w-[15px]" /> Demo
            </button>
          </div>
          <p className="mt-3.5 text-center font-mono text-[11px] leading-snug text-slate-500">~38s · 4 sources · never stored</p>

          {(isComplete || isError) && (
            <button onClick={handleReset} className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 font-mono text-[12px] text-slate-400 hover:text-slate-100 transition-colors">
              Check another article
            </button>
          )}

          <div className="my-5 h-px bg-white/[0.08]" />
          <div className={`mb-3.5 flex items-center gap-1.5 ${EYEBROW}`}><Clock className="h-3 w-3" /> Recent checks</div>
          {recentChecks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {recentChecks.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <span className="flex-1 truncate text-[12.5px] text-slate-400">{c.title}</span>
                  <span className="font-mono text-xs font-semibold text-slate-300">{c.score}</span>
                  <span className="font-mono text-[10px] text-slate-500">{timeAgo(c.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-[12.5px] text-slate-500">No checks yet — results will appear here</p>
          )}
        </div>

        {/* RESULTS */}
        <div>
          {state.step === 'idle' ? (
            <div className={`relative ${CARD} px-10 py-20 text-center`}>
              <Ticks />
              <IconTile Icon={Shield} className="mx-auto mb-6 text-slate-300" size="h-[60px] w-[60px]" />
              <h3 className="mb-3 font-serif text-2xl font-medium text-slate-100">Ready to verify</h3>
              <p className="mx-auto mb-7 max-w-[380px] text-[15.5px] leading-relaxed text-slate-400">Paste an article and hit Analyze — or run the demo to watch SachCheck dissect a viral story claim by claim.</p>
              <button onClick={() => { setInput(DEMO_ARTICLE); setTimeout(() => analyze(DEMO_ARTICLE), 50) }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4f8dfd] px-5 py-3 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-[#6aa0ff]">
                <FlaskConical className="h-4 w-4" /> Run the demo
              </button>
            </div>
          ) : isError ? (
            <div className={`relative ${CARD} px-10 py-20 text-center`}>
              <Ticks />
              <IconTile Icon={XCircle} className="mx-auto mb-6 text-rose-400" size="h-[60px] w-[60px]" />
              <h3 className="mb-3 font-serif text-2xl font-medium text-slate-100">Analysis failed</h3>
              <p className="mx-auto mb-7 max-w-[380px] text-[15px] text-slate-400">{state.error}</p>
              <button onClick={handleReset} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[15px] font-semibold text-slate-100 hover:border-white/20 transition-colors">
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className={`relative overflow-hidden ${CARD} px-7 py-6`}>
                {isAnalyzing && (
                  <motion.div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-[#4f8dfd]/10 to-transparent"
                    animate={{ y: ['-100%', '900%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
                )}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {isComplete
                      ? <><CheckCircle2 className="h-[18px] w-[18px] text-emerald-400" /><span className="text-[15px] font-semibold text-slate-100">Analysis complete</span></>
                      : <><Loader2 className="h-4 w-4 animate-spin text-[#4f8dfd]" /><span className="text-[15px] font-semibold text-slate-100">Running pipeline…</span></>}
                  </div>
                  <span className="font-mono text-[11.5px] text-slate-500">{state.claims.length} claims extracted</span>
                </div>
                <RunStatus step={state.step} />
              </div>

              <AnimatePresence>
                {state.claims.map((c: any, i: number) => <ClaimCard key={c.id} claim={c} index={i} />)}
              </AnimatePresence>

              {state.claims.length === 0 && isAnalyzing && (
                <div className={`${CARD} p-10 text-center`}>
                  <Loader2 className="mx-auto mb-3.5 h-6 w-6 animate-spin text-[#4f8dfd]" />
                  <p className="font-mono text-[13px] text-slate-400">Parsing article · isolating atomic claims…</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SCORE */}
        <div className="lg:sticky lg:top-[88px]">
          <ScorePanel state={state} />
        </div>
      </div>
    </div>
  )
}
