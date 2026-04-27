import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { verdictConfig } from '../lib/utils'
import type { VerdictType } from '../types'

interface VerdictBadgeProps {
  verdict: VerdictType
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

const icons: Record<VerdictType, React.ReactNode> = {
  true: <CheckCircle2 size={12} />,
  mostly_true: <TrendingUp size={12} />,
  mixed: <AlertTriangle size={12} />,
  mostly_false: <TrendingDown size={12} />,
  false: <XCircle size={12} />,
  unverified: <HelpCircle size={12} />,
}

const sizeClasses = {
  sm: 'text-[9px] px-1.5 py-0.5 gap-1',
  md: 'text-[10px] px-2.5 py-1 gap-1.5',
  lg: 'text-xs px-3 py-1.5 gap-1.5',
}

export function VerdictBadge({ verdict, size = 'md', showIcon = true }: VerdictBadgeProps) {
  const config = verdictConfig[verdict]

  return (
    <span
      className={cn(
        'inline-flex items-center font-bold tracking-widest uppercase rounded-full border',
        sizeClasses[size]
      )}
      style={{
        color: config.textColor,
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        boxShadow: config.glowColor,
      }}
    >
      {showIcon && icons[verdict]}
      {config.label}
    </span>
  )
}
