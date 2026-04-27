import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'
import {
  ChevronLeft, Sparkles, RotateCcw, ServerCrash,
  CheckCircle2, AlertTriangle, XCircle, HelpCircle,
  Image as ImageIcon, ScanLine, Loader2
} from 'lucide-react'
import { ImageUpload } from '../components/ImageUpload'
import { ImageResultsPanel } from '../components/ImageResultsPanel'
import { useImageAnalysis } from '../hooks/useImageAnalysis'
import type { AppView, ImagePipelineStep } from '../types'

interface ImageCheckPageProps {
  onNavigate: (view: AppView) => void
}

// ── Pipeline progress steps ────────────────────────────────────────────────────

const PIPELINE_STEPS: Array<{ step: ImagePipelineStep | ImagePipelineStep[]; label: string; icon: React.ReactNode }> = [
  { step: 'preprocessing', label: 'Image preprocessing', icon: <ImageIcon size={12} /> },
  { step: ['ocr_running', 'ocr_complete'], label: 'OCR text extraction', icon: <ScanLine size={12} /> },
  { step: 'extracting', label: 'Claim extraction', icon: <Sparkles size={12} /> },
  { step: 'gathering', label: 'Evidence gathering', icon: <CheckCircle2 size={12} /> },
  { step: 'signals', label: 'Manipulation signals', icon: <AlertTriangle size={12} /> },
  { step: 'synthesizing', label: 'Verdict synthesis', icon: <Sparkles size={12} /> },
]

const STEP_ORDER: ImagePipelineStep[] = [
  'preprocessing', 'ocr_running', 'ocr_complete',
  'extracting', 'gathering', 'signals', 'synthesizing', 'complete',
]

function stepIndex(step: ImagePipelineStep): number {
  return STEP_ORDER.indexOf(step)
}

function isStepDone(currentStep: ImagePipelineStep, pipelineStep: ImagePipelineStep | ImagePipelineStep[]): boolean {
  const steps = Array.isArray(pipelineStep) ? pipelineStep : [pipelineStep]
  return steps.some(s => stepIndex(currentStep) > stepIndex(s))
}

function isStepActive(currentStep: ImagePipelineStep, pipelineStep: ImagePipelineStep | ImagePipelineStep[]): boolean {
  const steps = Array.isArray(pipelineStep) ? pipelineStep : [pipelineStep]
  return steps.includes(currentStep)
}

function PipelineProgress({ step, progress }: { step: ImagePipelineStep; progress: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Loader2 size={14} className="text-blue-400 animate-spin" />
        <span className="text-sm font-semibold text-white">Analysing image…</span>
        <span className="ml-auto text-xs text-blue-400 font-bold">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          style={{ boxShadow: '0 0 8px rgba(59,130,246,0.5)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {PIPELINE_STEPS.map(({ step: s, label, icon }) => {
          const done   = isStepDone(step, s)
          const active = isStepActive(step, s)
          return (
            <div key={label} className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                done   ? 'bg-emerald-500/20 text-emerald-400' :
                active ? 'bg-blue-500/20 text-blue-400' :
                         'bg-white/[0.04] text-slate-600'
              }`}>
                {done ? <CheckCircle2 size={11} /> : icon}
              </div>
              <span className={`text-xs transition-colors ${
                done   ? 'text-emerald-400' :
                active ? 'text-slate-200 font-medium' :
                         'text-slate-600'
              }`}>
                {label}
              </span>
              {active && (
                <motion.div
                  className="ml-auto flex gap-0.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 rounded-full bg-blue-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

function AnalyzeButton({ onClick, disabled, isAnalyzing }: {
  onClick: () => void; disabled: boolean; isAnalyzing: boolean
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
        disabled
          ? 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
      }`}
    >
      {isAnalyzing ? (
        <><Loader2 size={15} className="animate-spin" /> Analysing…</>
      ) : (
        <><ScanLine size={15} /> Fact-Check This Image</>
      )}
    </motion.button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function ImageCheckPage({ onNavigate }: ImageCheckPageProps) {
  const { state, analyze, reset } = useImageAnalysis()
  const [file, setFile]           = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isAnalyzing = !['idle', 'complete', 'error'].includes(state.step)
  const isComplete  = state.step === 'complete'
  const isError     = state.step === 'error'

  const handleFile = useCallback((f: File) => {
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    reset()
  }, [reset])

  const handleClear = useCallback(() => {
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    reset()
  }, [previewUrl, reset])

  const handleAnalyze = () => {
    if (file) analyze(file)
  }

  const handleReset = () => {
    handleClear()
    reset()
  }

  return (
    <div className="min-h-screen pt-14 sm:pt-16 pb-16">
      {/* Back nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 mb-4 sm:mb-6">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors group"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </button>
      </div>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-black text-white">Image Fact-Check</h1>
              <span className="text-[10px] font-bold text-blue-400 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                NEW
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Screenshots · WhatsApp forwards · Viral posters · Fake headlines — verified in seconds
            </p>
          </div>
          {isComplete && state.imageScore && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 flex-wrap"
            >
              {state.imageScore.band === 'green' && <CheckCircle2 size={14} className="text-emerald-400" />}
              {state.imageScore.band === 'yellow' && <AlertTriangle size={14} className="text-amber-400" />}
              {state.imageScore.band === 'red'    && <XCircle size={14} className="text-red-400" />}
              {state.imageScore.band === 'insufficient' && <HelpCircle size={14} className="text-slate-400" />}
              <span className="text-sm font-semibold text-white">{state.imageScore.verdict_label}</span>
              <span className="text-xs text-slate-500">
                Score: <span className="text-white font-bold">{state.imageScore.overall_score}/100</span>
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 sm:gap-6">

          {/* LEFT: Upload + controls */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">

            {/* Upload area */}
            <div className="rounded-2xl border border-white/[0.08] bg-navy-800/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={13} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upload Image</span>
              </div>

              <ImageUpload
                onFile={handleFile}
                isAnalyzing={isAnalyzing}
                previewUrl={previewUrl}
                onClear={handleClear}
              />

              <div className="mt-3">
                {!isComplete ? (
                  <AnalyzeButton
                    onClick={handleAnalyze}
                    disabled={!file || isAnalyzing}
                    isAnalyzing={isAnalyzing}
                  />
                ) : (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] transition-all"
                  >
                    <RotateCcw size={14} />
                    Check Another Image
                  </motion.button>
                )}
              </div>

              {!isAnalyzing && !isComplete && (
                <p className="text-[11px] text-slate-600 text-center mt-2">
                  Free OCR · Claude Vision fallback · ~$0.01/image
                </p>
              )}
            </div>

            {/* Example content types */}
            {!file && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Works great with</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    '📱 WhatsApp forwards',
                    '🐦 Tweet screenshots',
                    '📰 Fake headlines',
                    '📊 Viral infographics',
                    '🗞️ Newspaper clippings',
                    '📢 Political posters',
                  ].map(item => (
                    <div key={item} className="text-[11px] text-slate-600 flex items-center gap-1">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Results */}
          <div>
            <AnimatePresence mode="wait">
              {/* Error */}
              {isError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-red-500/8 border border-red-500/20 flex items-center justify-center mb-4">
                    <ServerCrash size={24} className="text-red-400" />
                  </div>
                  <h3 className="text-base font-semibold text-red-400 mb-2">Analysis failed</h3>
                  <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-5 px-4">
                    {state.error ?? 'Something went wrong.'}
                  </p>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:bg-white/10 transition-all"
                  >
                    <RotateCcw size={13} /> Try again
                  </button>
                </motion.div>
              )}

              {/* Empty */}
              {state.step === 'idle' && !isError && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/8 border border-purple-500/15 flex items-center justify-center mb-4">
                    <ScanLine size={24} className="text-purple-400/50" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-400 mb-2">Upload an image to begin</h3>
                  <p className="text-xs text-slate-600 max-w-xs leading-relaxed px-4">
                    SachCheck reads text from your image, extracts factual claims, detects manipulation signals, and cross-verifies against 4 sources.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {[
                      { icon: <CheckCircle2 size={12} />, text: 'OCR extraction', color: 'text-blue-400' },
                      { icon: <AlertTriangle size={12} />, text: 'Manipulation signals', color: 'text-amber-400' },
                      { icon: <XCircle size={12} />, text: 'Source cross-check', color: 'text-red-400' },
                    ].map(({ icon, text, color }) => (
                      <div key={text} className={`flex items-center gap-1.5 text-xs ${color}`}>
                        {icon} {text}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Pipeline progress */}
              {isAnalyzing && (
                <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <PipelineProgress step={state.step} progress={state.progress} />

                  {/* Live OCR text preview */}
                  <AnimatePresence>
                    {state.ocrText && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                      >
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
                          Text detected ({state.ocrMethod})
                        </p>
                        <p className="text-xs text-slate-400 font-mono leading-relaxed">
                          {state.ocrText.slice(0, 300)}{state.ocrText.length > 300 ? '…' : ''}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Live claim chips */}
                  <AnimatePresence>
                    {state.claims.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                      >
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
                          Claims found ({state.claims.length})
                        </p>
                        <div className="space-y-1.5">
                          {state.claims.map((c, i) => (
                            <motion.div
                              key={c.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-start gap-2 text-xs text-slate-400"
                            >
                              <span className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-[9px] flex-shrink-0 mt-0.5 font-bold">
                                {i + 1}
                              </span>
                              {c.text}
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Results */}
              {isComplete && state.imageScore && (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ImageResultsPanel score={state.imageScore} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  )
}
