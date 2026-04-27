import { motion } from 'framer-motion'
import {
  CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  Laugh, TrendingDown, TrendingUp, ChevronDown,
  FileText, Shield, Zap, Globe
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'
import type { ImageScore, ManipulationSignal } from '../types'

// ── Verdict config ─────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  'Likely Authentic': {
    icon: <CheckCircle2 size={20} />,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.25)',
    text: 'text-emerald-400',
  },
  'Potentially Misleading': {
    icon: <AlertTriangle size={20} />,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.25)',
    text: 'text-amber-400',
  },
  'Likely False': {
    icon: <XCircle size={20} />,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.25)',
    text: 'text-red-400',
  },
  'Unverifiable': {
    icon: <HelpCircle size={20} />,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.20)',
    text: 'text-slate-400',
  },
  'Satire Risk': {
    icon: <Laugh size={20} />,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.25)',
    text: 'text-purple-400',
  },
}

const SEVERITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#94a3b8' }

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="50" cy="50" r={r}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{score}</span>
        <span className="text-[9px] text-slate-500 uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  )
}

function SignalRow({ signal }: { signal: ManipulationSignal }) {
  if (!signal.fired) return null
  const isPositive = signal.weight > 0
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0"
    >
      <div className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isPositive ? 'bg-emerald-500/15' : 'bg-red-500/15',
      )}>
        {isPositive
          ? <TrendingUp size={10} className="text-emerald-400" />
          : <TrendingDown size={10} className="text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-300 font-medium leading-tight">{signal.label}</span>
          <span className={cn('text-xs font-bold flex-shrink-0', signal.severity === 'high' ? 'text-red-400' : signal.severity === 'medium' ? 'text-amber-400' : 'text-slate-500')}>
            {SEVERITY_COLOR[signal.severity] && (
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: SEVERITY_COLOR[signal.severity] }} />
            )}
            {signal.severity}
          </span>
        </div>
        <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{signal.description}</p>
      </div>
    </motion.div>
  )
}

function OCRCard({ text, confidence, language, method }: {
  text: string; confidence: number; language: string; method: string
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = text.length > 200 ? text.slice(0, 200) + '…' : text
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={13} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Extracted Text</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-slate-600 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
            {(confidence * 100).toFixed(0)}% confidence
          </span>
          <span className="text-[10px] text-slate-600 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full uppercase">
            {language}
          </span>
          <span className="text-[10px] text-slate-700 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
            via {method === 'claude_vision' ? 'Claude Vision' : 'Tesseract'}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-wrap bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
        {expanded ? text : preview}
      </p>
      {text.length > 200 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
            <ChevronDown size={12} />
          </motion.span>
          {expanded ? 'Show less' : 'Show full text'}
        </button>
      )}
    </div>
  )
}

function EvidenceCard({ evidence }: { evidence: ImageScore['evidence_summary'] }) {
  const total = evidence.google_fact_check_reviews.length + evidence.wikipedia_summaries.length + evidence.gdelt_volume
  if (total === 0) return null
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe size={13} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evidence Found</span>
      </div>
      <div className="space-y-2">
        {evidence.google_fact_check_reviews.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0',
              r.verdict.toLowerCase().includes('false') ? 'bg-red-500/15 text-red-400' :
              r.verdict.toLowerCase().includes('true')  ? 'bg-emerald-500/15 text-emerald-400' :
              'bg-amber-500/15 text-amber-400'
            )}>
              {r.verdict.slice(0, 12)}
            </span>
            <span className="text-slate-500 leading-snug">{r.claim.slice(0, 80)}{r.claim.length > 80 ? '…' : ''}</span>
            <span className="text-slate-700 flex-shrink-0">— {r.publisher}</span>
          </div>
        ))}
        {evidence.wikipedia_summaries.map((w, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-slate-700">Wikipedia:</span> {w.title}
          </div>
        ))}
        {evidence.gdelt_volume > 0 && (
          <div className="text-xs text-slate-500">
            <span className="text-slate-700">GDELT:</span> {evidence.gdelt_volume} related news items
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface ImageResultsPanelProps {
  score: ImageScore
}

export function ImageResultsPanel({ score }: ImageResultsPanelProps) {
  const cfg = VERDICT_CONFIG[score.verdict_label] ?? VERDICT_CONFIG['Unverifiable']
  const firedSignals = score.manipulation_signals.filter(s => s.fired)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* ── Verdict card ── */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: cfg.bg, borderColor: cfg.border }}
      >
        <div className="flex items-start gap-4">
          <ScoreRing score={score.overall_score} color={cfg.color} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <span className={cn('text-base font-black', cfg.text)}>{score.verdict_label}</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mb-2">
              Confidence: {(score.confidence * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">{score.reasoning}</p>
          </div>
        </div>

        {score.safer_context && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
            <Shield size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-blue-400 font-semibold">Verify: </span>{score.safer_context}
            </p>
          </div>
        )}
      </div>

      {/* ── OCR text ── */}
      {score.extracted_text && (
        <OCRCard
          text={score.extracted_text}
          confidence={score.ocr_confidence}
          language={score.ocr_language}
          method={score.ocr_method}
        />
      )}

      {/* ── Claims found ── */}
      {score.extracted_claims.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Claims Extracted ({score.extracted_claims.length})
            </span>
          </div>
          <div className="space-y-2">
            {score.extracted_claims.map((claim, i) => (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-2.5 text-xs"
              >
                <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-slate-300 leading-snug">{claim.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Manipulation signals ── */}
      {firedSignals.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Manipulation Signals ({firedSignals.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, score.signal_score)}%`,
                    backgroundColor: score.signal_score > 60 ? '#ef4444' : score.signal_score > 30 ? '#f59e0b' : '#10b981',
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{score.signal_score}/100</span>
            </div>
          </div>
          <div>
            {firedSignals.map(s => <SignalRow key={s.signal} signal={s} />)}
          </div>
        </div>
      )}

      {/* ── Evidence ── */}
      <EvidenceCard evidence={score.evidence_summary} />

      {/* ── Disclaimer ── */}
      <p className="text-[10px] text-slate-700 text-center leading-relaxed">
        AI-assisted analysis — not a legal or editorial determination.
        Always verify with primary sources.
      </p>
    </motion.div>
  )
}
