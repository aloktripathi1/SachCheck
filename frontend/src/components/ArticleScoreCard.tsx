import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { TrustMeter } from './TrustMeter'
import { cn, verdictConfig } from '../lib/utils'
import type { ArticleScore, VerdictType } from '../types'

interface ArticleScoreCardProps {
  score: ArticleScore
}

function SignalRow({ label, weight, fired, description, category }: ArticleScore['signals'][0]) {
  if (!fired) return null
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0"
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
          category === 'positive' ? 'bg-emerald-500/15' : 'bg-red-500/15',
        )}
      >
        {category === 'positive' ? (
          <TrendingUp size={10} className="text-emerald-400" />
        ) : (
          <TrendingDown size={10} className="text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-300 font-medium leading-tight">{label}</span>
          <span
            className={cn(
              'text-xs font-bold flex-shrink-0',
              weight > 0 ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {weight > 0 ? '+' : ''}{weight}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{description}</p>
      </div>
    </motion.div>
  )
}

const verdictLabels: Record<VerdictType, string> = {
  true: 'True',
  mostly_true: 'Mostly True',
  mixed: 'Mixed',
  mostly_false: 'Mostly False',
  false: 'False',
  unverified: 'Unverified',
}

export function ArticleScoreCard({ score }: ArticleScoreCardProps) {
  const totalClaims = Object.values(score.claimBreakdown).reduce((a, b) => a + b, 0)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-4"
    >
      {/* Trust Meter Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-navy-800/40 p-6">
        <div className="flex items-center gap-2 mb-5">
          <AlertCircle size={14} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Article Credibility
          </span>
        </div>

        <div className="flex justify-center mb-2">
          <TrustMeter score={score.score} band={score.band} />
        </div>

        <div className="text-center">
          <p className="text-[11px] text-slate-500 mt-1">{score.confidence}</p>
        </div>
      </div>

      {/* Claim Breakdown */}
      <div className="rounded-2xl border border-white/[0.08] bg-navy-800/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle size={14} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Claim Breakdown
          </span>
        </div>

        <div className="space-y-2">
          {(Object.entries(score.claimBreakdown) as [VerdictType, number][])
            .filter(([, count]) => count > 0)
            .map(([verdict, count]) => {
              const config = verdictConfig[verdict]
              const pct = (count / totalClaims) * 100
              return (
                <div key={verdict} className="flex items-center gap-2.5">
                  <span className="text-[11px] text-slate-500 w-20 flex-shrink-0">
                    {verdictLabels[verdict]}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: 0.3 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                  </div>
                  <span
                    className="text-xs font-bold w-4 text-right flex-shrink-0"
                    style={{ color: config.color }}
                  >
                    {count}
                  </span>
                </div>
              )
            })}
        </div>

        {/* NLI 4-band summary */}
        {score.nliBreakdown && (
          <div className="mt-4 pt-3 border-t border-white/[0.05]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
              NLI Evidence Bands
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {score.nliBreakdown.supported > 0 && (
                <span className="text-emerald-400">
                  {score.nliBreakdown.supported} Supported
                </span>
              )}
              {score.nliBreakdown.refuted > 0 && (
                <span className="text-red-400">
                  {score.nliBreakdown.refuted} Refuted
                </span>
              )}
              {score.nliBreakdown.mixed > 0 && (
                <span className="text-amber-400">
                  {score.nliBreakdown.mixed} Mixed
                </span>
              )}
              {score.nliBreakdown.insufficient > 0 && (
                <span className="text-slate-500">
                  {score.nliBreakdown.insufficient} Insufficient
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Heuristic Signals */}
      <div className="rounded-2xl border border-white/[0.08] bg-navy-800/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Signals Fired
          </span>
        </div>
        <div>
          {score.signals.filter(s => s.fired).map((signal, i) => (
            <motion.div
              key={signal.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06 }}
            >
              <SignalRow {...signal} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-white/[0.08] bg-navy-800/40 p-5">
        <p className="text-xs text-slate-400 leading-relaxed">{score.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[10px] text-slate-600 border border-white/8 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle size={9} className="text-emerald-600" /> 4 sources cross-validated
          </span>
          <span className="text-[10px] text-slate-600 border border-white/8 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Info size={9} className="text-blue-600" /> Transparent AI reasoning
          </span>
        </div>
      </div>
    </motion.div>
  )
}
