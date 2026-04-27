import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Copy, Share2, Tag, Brain } from 'lucide-react'
import { VerdictBadge } from './VerdictBadge'
import { SourceChip } from './SourceChip'
import { verdictConfig } from '../lib/utils'
import type { Claim } from '../types'

interface ClaimCardProps {
  claim: Claim
  index: number
}

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

export function ClaimCard({ claim, index }: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false)
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative rounded-2xl border border-white/[0.08] bg-navy-800/40 overflow-hidden group hover:border-white/[0.14] transition-colors duration-300"
      style={{ boxShadow: 'card' }}
    >
      {/* Left verdict bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: config.color, boxShadow: `0 0 12px ${config.color}60` }}
      />

      <div className="pl-5 pr-5 pt-5 pb-4 ml-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Claim number */}
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ backgroundColor: `${config.color}20`, color: config.color }}
            >
              {index + 1}
            </div>
            <p className="text-[14px] text-slate-200 leading-snug font-medium flex-1">
              {claim.text}
            </p>
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

        {/* Verdict + Entity row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <VerdictBadge verdict={claim.verdict} size="md" />
          {claim.entity && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
              <Tag size={9} />
              {claim.entity}
            </span>
          )}
        </div>

        {/* Confidence bar */}
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
                style={{
                  backgroundColor: config.color,
                  boxShadow: `0 0 6px ${config.color}80`,
                }}
              />
            </div>
          </div>
        )}

        {/* Explanation */}
        {claim.explanation && (
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            {claim.explanation}
          </p>
        )}

        {/* Sources */}
        {claim.sources && claim.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {claim.sources.map((source, i) => (
              <SourceChip key={i} source={source} />
            ))}
          </div>
        )}

        {/* Expand reasoning */}
        {claim.reasoning && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1 focus:outline-none focus:text-slate-300"
              aria-expanded={expanded}
            >
              <Brain size={12} />
              <span>{expanded ? 'Hide' : 'Show'} AI reasoning</span>
              <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={12} />
              </motion.span>
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                    <p className="text-xs text-slate-400 leading-relaxed italic">
                      {claim.reasoning}
                    </p>
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
      </div>
    </motion.article>
  )
}
