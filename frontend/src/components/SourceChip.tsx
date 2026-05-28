import { ExternalLink, ShieldCheck, Newspaper, BookOpen, Globe2, Building2 } from 'lucide-react'
import type { EvidenceSource } from '../types'
import { cn } from '../lib/utils'

interface SourceChipProps {
  source: EvidenceSource
  showSnippet?: boolean
}

const typeIcon: Record<EvidenceSource['type'], React.ReactNode> = {
  'fact-checker': <ShieldCheck size={11} />,
  'wikipedia': <BookOpen size={11} />,
  'news': <Newspaper size={11} />,
  'academic': <Globe2 size={11} />,
  'government': <Building2 size={11} />,
}

const credibilityStyles: Record<EvidenceSource['credibility'], string> = {
  high: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  medium: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  low: 'border-red-500/30 bg-red-500/5 text-red-400',
}

const credibilityDot: Record<EvidenceSource['credibility'], string> = {
  high: 'bg-emerald-400',
  medium: 'bg-amber-400',
  low: 'bg-red-400',
}

export function SourceChip({ source, showSnippet = false }: SourceChipProps) {
  return (
    <div className="group">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
          'transition-all duration-200 hover:brightness-125',
          credibilityStyles[source.credibility]
        )}
        aria-label={`View source: ${source.name}`}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', credibilityDot[source.credibility])} />
        {typeIcon[source.type]}
        <span>{source.name}</span>
        <ExternalLink size={9} className="opacity-50 group-hover:opacity-100 transition-opacity" />
      </a>
      {showSnippet && source.snippet && (
        <p className="mt-1.5 text-xs text-slate-500 italic pl-1 leading-relaxed">
          "{source.snippet}"
        </p>
      )}
    </div>
  )
}
