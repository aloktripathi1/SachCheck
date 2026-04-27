import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Link2, FileText, Sparkles, X,
  Clock, ArrowRight, RotateCcw, FlaskConical
} from 'lucide-react'
import { cn } from '../lib/utils'
import { MOCK_ARTICLE_TEXT } from '../lib/mockData'

type InputMode = 'url' | 'text'

interface InputPanelProps {
  onAnalyze: (input: string) => void
  onReset: () => void
  isAnalyzing: boolean
  isComplete: boolean
}

const RECENT_CHECKS = [
  { title: 'RBI Emergency Crypto Directive', score: 31, band: 'red' as const, time: '2m ago' },
  { title: 'PM Modi climate summit speech', score: 78, band: 'green' as const, time: '1h ago' },
  { title: 'ISRO Mars mission funding', score: 52, band: 'yellow' as const, time: '3h ago' },
]

const bandColors = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' }

export function InputPanel({ onAnalyze, onReset, isAnalyzing, isComplete }: InputPanelProps) {
  const [mode, setMode] = useState<InputMode>('text')
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const val = input.trim()
    if (!val || isAnalyzing) return
    onAnalyze(val)
  }

  const handleDemo = () => {
    setMode('text')
    setInput(MOCK_ARTICLE_TEXT)
    textareaRef.current?.focus()
  }

  const handleReset = () => {
    setInput('')
    onReset()
  }

  const canSubmit = input.trim().length > 20 && !isAnalyzing

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-navy-800/40 overflow-hidden">
      {/* Tab switcher */}
      <div className="flex border-b border-white/[0.06] px-4 pt-4">
        {(['url', 'text'] as InputMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 focus:outline-none',
              mode === m
                ? 'text-white bg-white/[0.06] border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {m === 'url' ? <Link2 size={13} /> : <FileText size={13} />}
            {m === 'url' ? 'Paste URL' : 'Paste Text'}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        <AnimatePresence mode="wait">
          {mode === 'url' ? (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              <div className="relative flex items-center">
                <Link2 size={14} className="absolute left-3 text-slate-600 pointer-events-none" />
                <input
                  type="url"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="https://example.com/news-article"
                  className="w-full pl-9 pr-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
                  aria-label="Article URL"
                  disabled={isAnalyzing}
                />
                {input && (
                  <button
                    onClick={() => setInput('')}
                    className="absolute right-3 text-slate-600 hover:text-slate-400"
                    aria-label="Clear input"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-1.5 pl-1">
                Supports direct article URLs — paywall articles may need text paste
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="relative"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Paste article text here… (minimum 50 words recommended for accurate analysis)"
                rows={7}
                className="w-full p-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.04] transition-all resize-none leading-relaxed"
                aria-label="Article text"
                disabled={isAnalyzing}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {input && (
                  <button
                    onClick={() => setInput('')}
                    className="p-1 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-all"
                    aria-label="Clear text"
                  >
                    <X size={12} />
                  </button>
                )}
                <span className="text-[10px] text-slate-700 tabular-nums">
                  {input.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action row */}
        <div className="flex items-center gap-2">
          {!isComplete ? (
            <>
              <motion.button
                whileHover={{ scale: canSubmit ? 1.01 : 1 }}
                whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                  canSubmit
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
                )}
                aria-label="Analyze article"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Analyze Article
                    <ArrowRight size={13} />
                  </>
                )}
              </motion.button>

              <button
                onClick={handleDemo}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 border border-white/[0.08] hover:border-white/15 hover:text-slate-200 bg-white/[0.02] transition-all disabled:opacity-40"
                aria-label="Load demo article"
              >
                <FlaskConical size={13} />
                Demo
              </button>
            </>
          ) : (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] transition-all"
            >
              <RotateCcw size={14} />
              Check Another Article
            </motion.button>
          )}
        </div>

        {/* Hint */}
        {!isAnalyzing && !isComplete && (
          <p className="text-[11px] text-slate-600 text-center">
            Analyzes in ~38 seconds · $0.03 per check · 4 sources verified
          </p>
        )}
      </div>

      {/* Recent checks */}
      <div className="border-t border-white/[0.05] p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Clock size={11} className="text-slate-600" />
          <span className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">Recent Checks</span>
        </div>
        <div className="space-y-1.5">
          {RECENT_CHECKS.map((check, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors group"
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: bandColors[check.band] }}
              />
              <span className="flex-1 text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
                {check.title}
              </span>
              <span
                className="text-xs font-bold flex-shrink-0"
                style={{ color: bandColors[check.band] }}
              >
                {check.score}
              </span>
              <span className="text-[10px] text-slate-700 flex-shrink-0">{check.time}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
