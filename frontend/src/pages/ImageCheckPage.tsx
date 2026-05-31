import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Image as ImageIcon, ScanLine, Clipboard, Shield, Search,
  AlertTriangle, Check, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useImageAnalysis } from '../hooks/useImageAnalysis'
import type { AppView } from '../types'

const CARD = 'rounded-2xl border border-white/[0.08] bg-white/[0.02]'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500'

const Ticks = () => (
  <>
    <span className="pointer-events-none absolute left-3 top-3 h-2.5 w-2.5 border-l border-t border-white/20" />
    <span className="pointer-events-none absolute bottom-3 right-3 h-2.5 w-2.5 border-b border-r border-white/20" />
  </>
)

function IconTile({ Icon, className = '', size = 'h-[46px] w-[46px]' }: { Icon: LucideIcon; className?: string; size?: string }) {
  return (
    <div className={`grid ${size} place-items-center rounded-xl border border-white/10 bg-white/[0.03] ${className}`}>
      <Icon className="h-5 w-5" />
    </div>
  )
}

const LVL: Record<string, string> = {
  high:   'border-rose-500/25 text-rose-400',
  medium: 'border-amber-500/25 text-amber-400',
  low:    'border-white/10 text-slate-500',
}

const PIPELINE_STEPS = [
  { id: 'preprocessing', label: 'Preprocessing' },
  { id: 'ocr_running',   label: 'Reading text'  },
  { id: 'extracting',    label: 'Extracting claims' },
  { id: 'gathering',     label: 'Gathering evidence' },
  { id: 'signals',       label: 'Detecting signals' },
  { id: 'synthesizing',  label: 'Synthesizing verdict' },
]

const STEP_ORDER = ['preprocessing', 'ocr_running', 'ocr_complete', 'extracting', 'gathering', 'signals', 'synthesizing', 'complete']

function PipelineStatus({ step }: { step: string }) {
  const currentIndex = STEP_ORDER.indexOf(step)
  return (
    <div className={`relative overflow-hidden ${CARD} px-7 py-5`}>
      <motion.div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-[#4f8dfd]/10 to-transparent"
        animate={{ y: ['-100%', '900%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="mb-4 flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-[#4f8dfd]" />
        <span className="text-[15px] font-semibold text-slate-100">Analyzing image…</span>
        <span className="ml-auto font-mono text-[11.5px] text-slate-500">{Math.round((currentIndex / (STEP_ORDER.length - 1)) * 100)}%</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STEPS.map((s) => {
          const sIndex = STEP_ORDER.indexOf(s.id)
          const done   = currentIndex > sIndex
          const active = STEP_ORDER[currentIndex] === s.id || (s.id === 'ocr_running' && step === 'ocr_complete')
          const cls = done
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : active
            ? 'border-[#4f8dfd]/30 bg-[#4f8dfd]/10 text-[#4f8dfd]'
            : 'border-white/10 bg-white/[0.03] text-slate-500'
          return (
            <div key={s.id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs ${cls}`}>
              {done   ? <Check className="h-3 w-3" strokeWidth={2.4} />
               : active ? <Loader2 className="h-3 w-3 animate-spin" />
               : <span className="h-3 w-3" />}
              {s.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ImageCheckPage({ go: _go }: { go: (v: AppView) => void }) {
  const { state, analyze: analyzeImage, reset } = useImageAnalysis()
  const [dragOver, setDragOver] = useState(false)
  const [pasteHint, setPasteHint] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const isAnalyzing = ['preprocessing', 'ocr_running', 'ocr_complete', 'extracting', 'gathering', 'signals', 'synthesizing'].includes(state.step)
  const isComplete  = state.step === 'complete'
  const isError     = state.step === 'error'
  const hasSignals  = state.signals && state.signals.length > 0

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setPreview(URL.createObjectURL(file))
    analyzeImage(file)
  }, [analyzeImage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // Attach paste to window so it works anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find(i => i.type.startsWith('image/'))?.getAsFile()
      if (file) {
        handleFile(file)
        setPasteHint(false)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  const verdict    = state.imageScore?.verdict_label
  const confidence = state.imageScore?.overall_score
  const summary    = state.imageScore?.reasoning
  const verdictMeta = {
    authentic:    { label: 'Likely authentic',                 text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', Icon: CheckCircle2  },
    inconclusive: { label: 'Inconclusive',                     text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   Icon: AlertTriangle },
    manipulated:  { label: 'Likely fabricated — do not share', text: 'text-rose-400',    border: 'border-rose-500/30',    bg: 'bg-rose-500/10',    Icon: XCircle       },
  }
  const vm = verdict ? (verdictMeta[verdict as keyof typeof verdictMeta] ?? verdictMeta.inconclusive) : null

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-10">
      <div className="mb-7">
        <div className={`mb-2.5 ${EYEBROW}`}>Image check · <span className="text-[#4f8dfd]">new</span></div>
        <h1 className="font-serif text-[clamp(34px,4vw,48px)] font-medium tracking-tight text-slate-100">Image fact-check</h1>
        <p className="mt-2.5 text-base text-slate-400">Screenshots · WhatsApp forwards · viral posters · fake headlines — verified in seconds.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[440px_1fr]">
        {/* UPLOAD PANEL */}
        <div className={`${CARD} p-7 lg:sticky lg:top-[88px]`}>
          <div className={`mb-4 flex items-center gap-1.5 ${EYEBROW}`}><ImageIcon className="h-3 w-3" /> Upload image</div>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-dashed transition-colors ${dragOver ? 'border-[#4f8dfd]/60 bg-[#4f8dfd]/[0.05]' : 'border-white/20 bg-white/[0.03] hover:border-[#4f8dfd]/40 hover:bg-white/[0.05]'}`}>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full rounded-2xl object-cover max-h-[260px]" />
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                  <span className="font-mono text-[12px] text-white">Click to change image</span>
                </div>
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <IconTile Icon={ImageIcon} className="mx-auto mb-4 text-slate-300" size="h-14 w-14" />
                <h3 className="mb-1.5 text-[17px] font-semibold text-slate-100">Drag &amp; drop an image</h3>
                <p className="mb-4 text-[13px] text-slate-500">or click to browse</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Screenshot', 'WhatsApp', 'Tweet', 'Poster'].map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-slate-400">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </label>

          <button
            onClick={() => setPasteHint(true)}
            className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] font-semibold text-slate-100 transition-colors hover:border-white/20">
            <Clipboard className="h-[15px] w-[15px]" /> Paste screenshot
          </button>

          {pasteHint && (
            <p className="mt-2 text-center font-mono text-[11px] text-[#4f8dfd]">
              Press Ctrl+V anywhere on this page to paste
            </p>
          )}

          <p className="mt-3 text-center font-mono text-[11px] text-slate-500">JPG · PNG · WebP · max 10MB · never stored</p>

          {(isComplete || isError) && (
            <button onClick={() => { reset(); setPreview(null) }}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 font-mono text-[12px] text-slate-400 hover:text-slate-100 transition-colors">
              Check another image
            </button>
          )}

          <div className="my-5 h-px bg-white/[0.08]" />
          <div className={`mb-3.5 ${EYEBROW}`}>Works great with</div>
          <div className="grid grid-cols-2 gap-2.5">
            {['WhatsApp forwards', 'Tweet screenshots', 'Fake headlines', 'Viral infographics', 'Newspaper clippings', 'Political posters'].map((t) => (
              <div key={t} className="flex items-center gap-2 text-[12.5px] text-slate-400">
                <span className="h-1 w-1 shrink-0 rounded-full bg-[#4f8dfd]" /> {t}
              </div>
            ))}
          </div>
        </div>

        {/* RESULTS PANEL */}
        <div>
          {state.step === 'idle' ? (
            <div className={`relative ${CARD} px-10 py-20 text-center`}>
              <Ticks />
              <IconTile Icon={ScanLine} className="mx-auto mb-6 text-slate-300" size="h-[60px] w-[60px]" />
              <h3 className="mb-3 font-serif text-2xl font-medium text-slate-100">Upload an image to begin</h3>
              <p className="mx-auto mb-7 max-w-[440px] text-[15.5px] leading-relaxed text-slate-400">SachCheck reads text from your image, extracts factual claims, detects manipulation signals, and cross-verifies against four sources.</p>
              <div className="flex flex-wrap justify-center gap-6">
                {([['OCR extraction', Search, 'text-[#4f8dfd]'], ['Manipulation signals', AlertTriangle, 'text-amber-400'], ['Source cross-check', Shield, 'text-emerald-400']] as const).map(([l, I, c]) => {
                  const Icon = I as LucideIcon
                  return <span key={l} className={`flex items-center gap-1.5 font-mono text-[12.5px] ${c}`}><Icon className="h-[15px] w-[15px]" /> {l}</span>
                })}
              </div>
            </div>
          ) : isError ? (
            <div className={`relative ${CARD} px-10 py-20 text-center`}>
              <Ticks />
              <IconTile Icon={XCircle} className="mx-auto mb-6 text-rose-400" size="h-[60px] w-[60px]" />
              <h3 className="mb-3 font-serif text-2xl font-medium text-slate-100">Analysis failed</h3>
              <p className="mx-auto mb-7 max-w-[380px] text-[15px] text-slate-400">{state.error}</p>
              <button onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[15px] font-semibold text-slate-100 hover:border-white/20 transition-colors">
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Pipeline progress */}
              {isAnalyzing && <PipelineStatus step={state.step} />}

              {/* OCR result */}
              {(state.ocrText || isComplete) && (
                <div className={`${CARD} p-7`}>
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className={`flex items-center gap-1.5 ${EYEBROW} text-[#4f8dfd]`}><Search className="h-3 w-3" /> OCR extraction</div>
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      <Check className="h-3 w-3" strokeWidth={2.4} /> Text read
                    </span>
                  </div>
                  <p className="m-0 font-serif text-[14.5px] italic leading-relaxed text-slate-400">"{state.ocrText}"</p>
                </div>
              )}

              {/* OCR skeleton while reading */}
              {!state.ocrText && isAnalyzing && (
                <div className={`${CARD} p-7`}>
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className={`flex items-center gap-1.5 ${EYEBROW} text-[#4f8dfd]`}><Search className="h-3 w-3" /> OCR extraction</div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10.5px] text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> reading…
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[100, 86, 64].map((w, i) => (
                      <div key={i} className="h-3 animate-pulse rounded bg-white/[0.06]" style={{ width: `${w}%`, animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Manipulation signals */}
              {hasSignals && (
                <div className={`${CARD} p-7`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`flex items-center gap-1.5 ${EYEBROW} text-amber-400`}><AlertTriangle className="h-3 w-3" /> Manipulation signals</div>
                    <span className="font-mono text-xs font-semibold text-rose-400">
                      {state.signals.filter((s) => s.severity === 'high').length} high-risk detected
                    </span>
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2.5">
                    {state.signals.map((sig) => (
                      <div key={sig.label} className={`rounded-xl border bg-white/[0.02] p-3.5 ${LVL[sig.severity] ?? LVL.low}`}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[13.5px] font-semibold text-slate-100">{sig.label}</span>
                          <span className={`font-mono text-[9.5px] uppercase tracking-widest ${(LVL[sig.severity] ?? LVL.low).split(' ')[1]}`}>{sig.severity}</span>
                        </div>
                        <p className="m-0 text-xs leading-snug text-slate-400">{sig.description}</p>
                      </div>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Signals skeleton while gathering */}
              {!hasSignals && ['gathering', 'signals', 'synthesizing'].includes(state.step) && (
                <div className={`${CARD} p-7`}>
                  <div className={`mb-4 flex items-center gap-1.5 ${EYEBROW} text-amber-400`}><AlertTriangle className="h-3 w-3" /> Detecting manipulation signals…</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Final verdict */}
              {isComplete && verdict && vm && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className={`relative overflow-hidden rounded-2xl border ${vm.border} p-7`}
                  style={{ background: `radial-gradient(500px 200px at 50% -40%, ${vm.border.includes('emerald') ? 'rgba(16,185,129,0.08)' : vm.border.includes('rose') ? 'rgba(244,63,94,0.12)' : 'rgba(245,158,11,0.08)'}, transparent)` }}>
                  <Ticks />
                  <div className="flex flex-wrap items-center gap-4">
                    <div className={`grid h-[54px] w-[54px] place-items-center rounded-xl border ${vm.border} ${vm.bg} ${vm.text}`}>
                      <vm.Icon className="h-[26px] w-[26px]" />
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${vm.border} ${vm.bg} ${vm.text}`}>
                        <vm.Icon className="h-3 w-3" /> {verdict}
                      </span>
                      <h3 className="mt-2 text-[19px] font-semibold text-slate-100">{vm.label}</h3>
                    </div>
                    {confidence != null && (
                      <div className="text-right">
                        <div className={`font-serif text-[44px] leading-none ${vm.text}`}>{Math.round(confidence)}<span className="text-lg">/100</span></div>
                        <div className="font-mono text-[10.5px] text-slate-500">credibility score</div>
                      </div>
                    )}
                  </div>
                  {summary && (
                    <>
                      <div className="my-5 h-px bg-white/[0.08]" />
                      <p className="m-0 text-[14px] leading-relaxed text-slate-400">{summary}</p>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
