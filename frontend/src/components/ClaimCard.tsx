import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Copy, Share2, Loader2 } from 'lucide-react'
import { VerdictBadge, NLIVerdictBadge } from './VerdictBadge'
import { SourceChip } from './SourceChip'
import { EvidenceStancePanel } from './EvidenceStancePanel'
import { verdictConfig } from '../lib/utils'
import { cn } from '../lib/utils'
import type { Claim, EntityTag } from '../types'

interface ClaimCardProps {
  claim: Claim
  index: number
}

// ── Entity chip colours ───────────────────────────────────────────────────────
const entityTypeStyle: Record<EntityTag['type'], string> = {
  PERSON:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ORG:      'bg-blue-500/10   text-blue-400   border-blue-500/20',
  LOC:      'bg-green-500/10  text-green-400  border-green-500/20',
  DATE:     'bg-amber-500/10  text-amber-400  border-amber-500/20',
  QUANTITY: 'bg-slate-500/10  text-slate-400  border-slate-500/20',
}

function EntityChip({ entity }: { entity: EntityTag }) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full border',
        entityTypeStyle[entity.type] ?? entityTypeStyle.QUANTITY
      )}
    >
      {entity.text}
    </span>
  )
}

// ── NLI stance bar ────────────────────────────────────────────────────────────
interface StanceBarProps {
  supporting: number
  contradicting: number
  neutral: number
}

function StanceBar({ supporting, contradicting, neutral }: StanceBarProps) {
  const total = supporting + contradicting + neutral
  if (total === 0) return null

  const supportPct      = (supporting / total) * 100
  const contradictPct   = (contradicting / total) * 100

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${supportPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full bg-emerald-500 rounded-l-full"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${contradictPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="h-full bg-red-500"
          />
          {/* remainder is gray (neutral) — implicit via bg-white/5 */}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[9px] text-slate-500">
        {supporting > 0 && (
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            {supporting} supporting
          </span>
        )}
        {contradicting > 0 && (
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            {contradicting} contradicting
          </span>
        )}
        {neutral > 0 && (
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
            {neutral} neutral
          </span>
        )}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonClaimCard() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full skeleton flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 skeleton rounded-md w-full" />
            <div className="h-4 skeleton rounded-md w-4/5" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 skeleton rounded-full" />
          <div className="h-6 w-16 skeleton rounded-full" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 skeleton rounded w-full" />
          <div className="h-3 skeleton rounded w-3/4" />
        </div>
      </div>
    </div>
  )
}

// ── Main ClaimCard ────────────────────────────────────────────────────────────
export function ClaimCard({ claim, index }: ClaimCardProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!claim.verdict) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08 }}
      >
        <SkeletonClaimCard />
      </motion.div>
    )
  }

  const config = verdictConfig[claim.verdict]

  const handleCopy = async () => {
    await navigator.clipboard.writeText(claim.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Derive neutral count from NLI totals if available
  const supporting    = claim.supporting_count ?? 0
  const contradicting = claim.contradicting_count ?? 0
  const hasNLI        = supporting > 0 || contradicting > 0
  // We don't receive neutral count from backend; infer it's non-zero only when we have some evidence
  const neutral = 0 // neutral count not currently sent; bar still useful with just support/refute

  // Placeholder empty passage arrays — real passages would come if backend sends them
  const supportingPassages  = (claim as any).supporting_evidence  ?? []
  const contradictingPassages = (claim as any).contradicting_evidence ?? []

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative rounded-2xl border border-white/[0.08] bg-navy-800/40 overflow-hidden group hover:border-white/[0.14] transition-colors duration-300"
    >
      {/* Left verdict bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: config.color, boxShadow: `0 0 12px ${config.color}60` }}
      />

      <div className="pl-5 pr-5 pt-5 pb-4 ml-1">
        {/* ── Top row: NLI band (left) + claim type pill (right) ── */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <VerdictBadge verdict={claim.verdict} size="md" />
            {claim.verdict_band && (
              <NLIVerdictBadge band={claim.verdict_band} size="sm" />
            )}
          </div>
          {claim.claim_type && (
            <span className="text-[9px] text-slate-500 bg-white/5 border border-white/[0.07] px-2 py-0.5 rounded-full capitalize flex-shrink-0">
              {claim.claim_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* ── Claim number + text ── */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-slate-200 leading-snug font-medium">{claim.text}</p>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-all"
              aria-label="Copy claim text"
              title={copied ? 'Copied!' : 'Copy'}
            >
              <Copy size={13} />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-all"
              aria-label="Share claim"
            >
              <Share2 size={13} />
            </button>
          </div>
        </div>

        {/* ── Entity chips ── */}
        {claim.entities && claim.entities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {claim.entities.map((e, i) => (
              <EntityChip key={i} entity={e} />
            ))}
          </div>
        )}

        {/* ── Reasoning (collapsed to 3 lines) ── */}
        {claim.explanation && (
          <div className="mb-3">
            <p
              className={cn(
                'text-xs text-slate-400 leading-relaxed',
                !reasoningExpanded && 'line-clamp-3'
              )}
            >
              {claim.explanation}
            </p>
            {claim.explanation.length > 180 && (
              <button
                onClick={() => setReasoningExpanded(v => !v)}
                className="text-[10px] text-slate-500 hover:text-slate-300 mt-1 transition-colors"
              >
                {reasoningExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* ── Confidence bar ── */}
        {claim.confidence !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                Confidence
              </span>
              <span className="text-[11px] font-bold" style={{ color: config.color }}>
                {Math.round(claim.confidence * 100)}%
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${claim.confidence * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className="h-full rounded-full"
                style={{ backgroundColor: config.color, boxShadow: `0 0 6px ${config.color}80` }}
              />
            </div>
          </div>
        )}

        {/* ── NLI stance bar ── */}
        {hasNLI && (
          <StanceBar supporting={supporting} contradicting={contradicting} neutral={neutral} />
        )}

        {/* ── Sources ── */}
        {claim.sources && claim.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {claim.sources.map((source, i) => (
              <SourceChip key={i} source={source} />
            ))}
          </div>
        )}

        {/* ── AI reasoning expand ── */}
        {claim.reasoning && (
          <>
            <button
              onClick={() => setReasoningExpanded(!reasoningExpanded)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1 focus:outline-none focus:text-slate-300"
              aria-expanded={reasoningExpanded}
            >
              <span>{reasoningExpanded ? 'Hide' : 'Show'} AI reasoning</span>
              <motion.span animate={{ rotate: reasoningExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={12} />
              </motion.span>
            </button>

            <AnimatePresence>
              {reasoningExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                    <p className="text-xs text-slate-400 leading-relaxed italic">{claim.reasoning}</p>
                    {claim.sources && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {claim.sources.map((source, i) => (
                          <SourceChip key={i} source={source} showSnippet />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── Web search pending indicator ── */}
        {claim.web_search_pending && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500">
            <Loader2 size={10} className="animate-spin text-blue-400" />
            Searching web for more sources…
          </div>
        )}

        {/* ── Evidence stance panel ── */}
        <EvidenceStancePanel
          supporting={supportingPassages}
          contradicting={contradictingPassages}
          webSearchUsed={claim.web_search_used}
        />
      </div>
    </motion.article>
  )
}
