import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ExternalLink, Globe } from 'lucide-react'
import { cn } from '../lib/utils'
import type { EvidencePassage } from '../types'

interface EvidenceStancePanelProps {
  supporting: EvidencePassage[]
  contradicting: EvidencePassage[]
  webSearchUsed?: boolean
}

const tierConfig = {
  A: { label: 'Verified Source', className: 'bg-green-500/15 text-green-400 border-green-500/25' },
  B: { label: 'Mainstream',      className: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
  C: { label: 'Other',           className: 'bg-slate-500/10 text-slate-500 border-slate-500/15' },
}

interface PassageRowProps {
  passage: EvidencePassage
  accentColor: string
  barColor: string
}

function PassageRow({ passage, accentColor, barColor }: PassageRowProps) {
  const tier = tierConfig[passage.tier] ?? tierConfig.C

  return (
    <a
      href={passage.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition-colors group/row',
        !passage.url && 'pointer-events-none'
      )}
      style={{ borderLeft: `2px solid ${accentColor}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[11px] font-medium text-slate-300 truncate">{passage.source_name}</span>
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0', tier.className)}>
            {tier.label}
          </span>
          {passage.url && (
            <ExternalLink size={9} className="text-slate-600 group-hover/row:text-slate-400 transition-colors flex-shrink-0 ml-auto" />
          )}
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{passage.text}</p>
        {/* Confidence bar */}
        <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden w-24">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.round(passage.confidence * 100)}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    </a>
  )
}

export function EvidenceStancePanel({ supporting, contradicting, webSearchUsed }: EvidenceStancePanelProps) {
  const [open, setOpen] = useState(false)

  const total = supporting.length + contradicting.length
  if (total === 0 && !webSearchUsed) return null

  return (
    <div className="mt-2 border-t border-white/[0.05] pt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1 w-full text-left focus:outline-none"
        aria-expanded={open}
      >
        <ChevronDown
          size={12}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
        <span>
          Show sources ({supporting.length} supporting
          {contradicting.length > 0 ? `, ${contradicting.length} contradicting` : ''})
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* Supporting */}
              {supporting.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-green-500/70 uppercase tracking-wider mb-1.5 px-1">
                    Supporting
                  </p>
                  <div className="space-y-1">
                    {supporting.map(p => (
                      <PassageRow
                        key={p.id}
                        passage={p}
                        accentColor="rgba(16,185,129,0.5)"
                        barColor="#10b981"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Contradicting */}
              {contradicting.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-red-500/70 uppercase tracking-wider mb-1.5 px-1">
                    Contradicting
                  </p>
                  <div className="space-y-1">
                    {contradicting.map(p => (
                      <PassageRow
                        key={p.id}
                        passage={p}
                        accentColor="rgba(239,68,68,0.5)"
                        barColor="#ef4444"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Web search used label */}
              {webSearchUsed && (
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <Globe size={10} className="text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] text-slate-500">
                    Web search was used to find additional sources
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
