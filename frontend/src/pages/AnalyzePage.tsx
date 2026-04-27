import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'
import {
  ShieldCheck, Sparkles, ChevronLeft, Info,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle, ServerCrash, RotateCcw
} from 'lucide-react'
import { InputPanel } from '../components/InputPanel'
import { PipelineVisualizer } from '../components/PipelineVisualizer'
import { ClaimCard } from '../components/ClaimCard'
import { ArticleScoreCard } from '../components/ArticleScoreCard'
import { useAnalysis } from '../hooks/useAnalysis'
import { useRecentChecks, titleFromInput } from '../hooks/useRecentChecks'
import type { AppView } from '../types'

interface AnalyzePageProps {
  onNavigate: (view: AppView) => void
}

function ErrorState({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-red-500/8 border border-red-500/20 flex items-center justify-center mb-5">
        <ServerCrash size={26} className="text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-red-400 mb-2">Analysis failed</h3>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">{message}</p>
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:bg-white/10 transition-all"
      >
        <RotateCcw size={13} /> Try again
      </button>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-blue-500/8 border border-blue-500/15 flex items-center justify-center mb-5">
        <ShieldCheck size={28} className="text-blue-500/50" />
      </div>
      <h3 className="text-base font-semibold text-slate-400 mb-2">Ready to verify</h3>
      <p className="text-sm text-slate-600 max-w-xs leading-relaxed">
        Paste an article URL or text on the left and click{' '}
        <span className="text-slate-500">Analyze Article</span> to begin.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-4 max-w-sm">
        {[
          { icon: <CheckCircle2 size={18} className="text-emerald-500" />, label: 'True claims', color: 'emerald' },
          { icon: <AlertTriangle size={18} className="text-amber-500" />, label: 'Mixed claims', color: 'amber' },
          { icon: <XCircle size={18} className="text-red-500" />, label: 'False claims', color: 'red' },
        ].map(({ icon, label, color }) => (
          <div key={label} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border border-${color}-500/10 bg-${color}-500/5`}>
            {icon}
            <span className="text-[10px] text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function SummaryBar({ claimsCount, falseCount, trueCount }: {
  claimsCount: number
  falseCount: number
  trueCount: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 flex-wrap"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-blue-400" />
        <span className="text-sm font-semibold text-white">{claimsCount} claims analyzed</span>
      </div>
      <div className="flex items-center gap-3">
        {trueCount > 0 && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> {trueCount} supported
          </span>
        )}
        {falseCount > 0 && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <XCircle size={12} /> {falseCount} refuted
          </span>
        )}
      </div>
    </motion.div>
  )
}

export function AnalyzePage({ onNavigate }: AnalyzePageProps) {
  const { state, analyze, reset } = useAnalysis()
  const { checks: recentChecks, add: addRecent, clear: clearRecent } = useRecentChecks()
  const pendingInputRef = useRef('')

  const isAnalyzing = ['extracting', 'gathering', 'scoring', 'synthesizing'].includes(state.step)
  const isComplete  = state.step === 'complete'
  const isError     = state.step === 'error'
  const hasResults  = state.claims.length > 0

  const verifiedClaims = state.claims.filter(c => c.verdict === 'true' || c.verdict === 'mostly_true')
  const falseClaims    = state.claims.filter(c => c.verdict === 'false' || c.verdict === 'mostly_false')

  // Track the input text so we can derive a title when analysis completes
  const handleAnalyze = (input: string) => {
    pendingInputRef.current = input
    analyze(input)
  }

  // Save to recent history whenever a check completes with a score
  useEffect(() => {
    if (state.step === 'complete' && state.articleScore && pendingInputRef.current) {
      addRecent({
        title: titleFromInput(pendingInputRef.current),
        score: state.articleScore.score,
        band:  state.articleScore.band,
      })
    }
  }, [state.step, state.articleScore, addRecent])

  return (
    <div className="min-h-screen pt-20 pb-16">
      {/* Back nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors group"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </button>
      </div>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">Analyze Article</h1>
            <p className="text-sm text-slate-500">
              Paste text or a URL · AI extracts claims · 4 sources verified · Verdicts in ~38s
            </p>
          </div>
          {isComplete && state.claims.length > 0 && (
            <SummaryBar
              claimsCount={state.claims.length}
              falseCount={falseClaims.length}
              trueCount={verifiedClaims.length}
            />
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_300px] gap-6">

          {/* LEFT: Input panel */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <InputPanel
              onAnalyze={handleAnalyze}
              onReset={reset}
              isAnalyzing={isAnalyzing}
              isComplete={isComplete}
              recentChecks={recentChecks}
              onClearRecent={clearRecent}
            />
          </div>

          {/* CENTER: Pipeline + Results */}
          <div className="space-y-6">
            {/* Pipeline visualizer */}
            <AnimatePresence>
              {isAnalyzing && (
                <PipelineVisualizer
                  step={state.step}
                  progress={state.progress}
                  claimCount={state.claims.length}
                />
              )}
            </AnimatePresence>

            {/* Error / Empty state */}
            {isError && <ErrorState message={state.error ?? 'Something went wrong.'} onReset={reset} />}
            {!hasResults && !isAnalyzing && !isError && <EmptyState />}

            {hasResults && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {state.claims.filter(c => c.verdict).length === state.claims.length && isComplete
                      ? 'Verified Claims'
                      : 'Extracting Claims'}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-xs text-slate-600">
                    {state.claims.filter(c => c.verdict).length}/{state.claims.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {state.claims.map((claim, idx) => (
                    <ClaimCard key={claim.id} claim={claim} index={idx} />
                  ))}
                </div>
              </div>
            )}

            {/* Methodology note */}
            {isComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-start gap-2.5 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <Info size={13} className="text-slate-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Verdicts represent AI-assisted analysis, not legal or editorial fact-checking.
                  Always cross-reference with primary sources. <a href="#" className="text-blue-500/70 hover:text-blue-400 underline underline-offset-2">Read methodology →</a>
                </p>
              </motion.div>
            )}
          </div>

          {/* RIGHT: Score panel */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <AnimatePresence>
              {isComplete && state.articleScore ? (
                <ArticleScoreCard score={state.articleScore} />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6"
                >
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center py-8">
                      <div className="relative w-24 h-24 mb-4">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                          <motion.circle
                            cx="50" cy="50" r="40"
                            fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={251}
                            animate={{ strokeDashoffset: [251, 100, 200] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles size={20} className="text-blue-400 animate-pulse" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 text-center">Calculating credibility score…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-3">
                        <HelpCircle size={22} className="text-slate-700" />
                      </div>
                      <p className="text-xs text-slate-600 max-w-[200px] leading-relaxed">
                        Article credibility score will appear here after analysis
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
