import { motion, AnimatePresence } from 'framer-motion'
import {
  Scissors, Globe, BarChart3, Sparkles,
  CheckCircle2, Loader2, Clock
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { PipelineStep } from '../types'

interface PipelineVisualizerProps {
  step: PipelineStep
  progress: number
  claimCount?: number
}

const steps = [
  {
    key: 'extracting' as PipelineStep,
    label: 'Extract Claims',
    sublabel: 'Claude Haiku 4.5',
    icon: Scissors,
    color: '#3b82f6',
    description: 'Identifying verifiable statements',
    latency: '~1s',
  },
  {
    key: 'gathering' as PipelineStep,
    label: 'Gather Evidence',
    sublabel: '4 sources in parallel',
    icon: Globe,
    color: '#8b5cf6',
    description: 'Google FC · Wikipedia · GDELT · ClaimBuster',
    latency: '~8s',
  },
  {
    key: 'scoring' as PipelineStep,
    label: 'Score Signals',
    sublabel: 'Heuristic engine',
    icon: BarChart3,
    color: '#f59e0b',
    description: 'Applying 11 credibility signals',
    latency: '~0.2s',
  },
  {
    key: 'synthesizing' as PipelineStep,
    label: 'Generate Verdicts',
    sublabel: 'Claude Sonnet 4.5',
    icon: Sparkles,
    color: '#10b981',
    description: 'Reasoning over all evidence',
    latency: '~28s',
  },
]

const stepOrder: PipelineStep[] = ['extracting', 'gathering', 'scoring', 'synthesizing', 'complete']

function getStepStatus(stepKey: PipelineStep, currentStep: PipelineStep): 'waiting' | 'active' | 'done' {
  const currentIdx = stepOrder.indexOf(currentStep)
  const stepIdx = stepOrder.indexOf(stepKey)
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'waiting'
}

const sourceLogos = [
  { name: 'Google FC', color: '#4285f4', abbr: 'G' },
  { name: 'Wikipedia', color: '#888', abbr: 'W' },
  { name: 'GDELT', color: '#f59e0b', abbr: 'GD' },
  { name: 'ClaimBuster', color: '#8b5cf6', abbr: 'CB' },
]

export function PipelineVisualizer({ step, progress, claimCount }: PipelineVisualizerProps) {
  if (step === 'idle' || step === 'complete') return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/[0.08] bg-navy-800/40 overflow-hidden"
    >
      {/* Progress bar at top */}
      <div className="h-0.5 bg-white/5 relative overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-blue-400 animate-ping opacity-40" />
            </div>
            <span className="text-sm font-semibold text-white">Analyzing Article</span>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">{Math.round(progress)}%</span>
        </div>

        {/* Pipeline steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map((s, idx) => {
            const status = getStepStatus(s.key, step)
            const Icon = s.icon

            return (
              <div key={s.key} className="relative">
                {/* Connector line (not on last) */}
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-[calc(100%-8px)] right-0 h-px z-10 overflow-hidden w-full">
                    <div className="h-px bg-white/8 w-[calc(100%+16px)] relative">
                      <AnimatePresence>
                        {status === 'done' && (
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            exit={{ scaleX: 0 }}
                            style={{ originX: 0, backgroundColor: s.color }}
                            className="absolute inset-0 h-full"
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.08 }}
                  className={cn(
                    'flex flex-col items-center text-center p-3 rounded-xl border transition-all duration-300',
                    status === 'active' && 'border-white/15 bg-white/[0.04]',
                    status === 'done' && 'border-white/8 bg-white/[0.02]',
                    status === 'waiting' && 'border-white/5 bg-transparent',
                  )}
                >
                  {/* Icon circle */}
                  <div
                    className="relative w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300"
                    style={{
                      backgroundColor: status === 'waiting' ? 'rgba(255,255,255,0.04)' : `${s.color}18`,
                      border: `1px solid ${status === 'waiting' ? 'rgba(255,255,255,0.06)' : `${s.color}40`}`,
                      boxShadow: status === 'active' ? `0 0 16px ${s.color}30` : 'none',
                    }}
                  >
                    {status === 'done' ? (
                      <CheckCircle2 size={18} style={{ color: s.color }} />
                    ) : status === 'active' ? (
                      <Loader2 size={18} style={{ color: s.color }} className="animate-spin" />
                    ) : (
                      <Icon size={18} className="text-slate-600" />
                    )}
                    {status === 'active' && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: `1px solid ${s.color}` }}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {/* Labels */}
                  <span
                    className={cn(
                      'text-xs font-semibold leading-tight mb-0.5 transition-colors',
                      status === 'active' ? 'text-white' : status === 'done' ? 'text-slate-300' : 'text-slate-600'
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="text-[9px] text-slate-600 leading-tight">{s.sublabel}</span>

                  {/* Status indicator */}
                  {status === 'active' && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-1.5 text-[9px] font-medium tracking-wide"
                      style={{ color: s.color }}
                    >
                      Processing…
                    </motion.span>
                  )}
                  {status === 'done' && (
                    <span className="mt-1.5 text-[9px] text-slate-600">{s.latency}</span>
                  )}
                  {status === 'waiting' && (
                    <span className="mt-1.5 text-[9px] text-slate-700 flex items-center gap-0.5">
                      <Clock size={8} /> {s.latency}
                    </span>
                  )}
                </motion.div>
              </div>
            )
          })}
        </div>

        {/* Live detail row */}
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <AnimatePresence mode="wait">
            {step === 'extracting' && (
              <motion.div key="extracting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1.5">Scanning article for verifiable claims…</div>
                  <div className="flex gap-1.5">
                    {[80, 55, 70, 45].map((w, i) => (
                      <motion.div
                        key={i}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: i * 0.15 }}
                        className="h-1.5 rounded-full bg-blue-500/30 origin-left"
                        style={{ width: `${w}px` }}
                      />
                    ))}
                  </div>
                </div>
                {claimCount !== undefined && claimCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-right"
                  >
                    <div className="text-lg font-bold text-blue-400">{claimCount}</div>
                    <div className="text-[10px] text-slate-500">claims found</div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 'gathering' && (
              <motion.div key="gathering" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-xs text-slate-400 mb-2">Querying 4 sources simultaneously…</div>
                <div className="flex gap-2 flex-wrap">
                  {sourceLogos.map((src, i) => (
                    <motion.div
                      key={src.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.15 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: src.color }}
                      >
                        {src.abbr.charAt(0)}
                      </div>
                      <span className="text-[10px] text-slate-400">{src.name}</span>
                      <Loader2 size={9} className="text-slate-600 animate-spin" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'scoring' && (
              <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-xs text-slate-400 mb-2">Applying heuristic signals…</div>
                <div className="grid grid-cols-3 gap-2">
                  {['Domain credibility', 'Source corroboration', 'Sentiment analysis', 'Citation quality', 'Coverage volume', 'Viral patterns'].map((sig, i) => (
                    <motion.div
                      key={sig}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                      <span className="text-[10px] text-slate-500">{sig}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'synthesizing' && (
              <motion.div key="synthesizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-xs text-slate-400 mb-2">Generating per-claim verdicts…</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
                      animate={{ width: ['0%', '80%', '85%', '95%'] }}
                      transition={{ duration: 5, ease: 'easeInOut' }}
                    />
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <Sparkles size={10} /> AI reasoning
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
