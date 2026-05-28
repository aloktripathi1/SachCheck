import { motion, useMotionValue, animate } from 'framer-motion'
import { useEffect, useState } from 'react'
import { getScoreColor, bandConfig } from '../lib/utils'
import type { CredibilityBand } from '../types'

interface TrustMeterProps {
  score: number
  band: CredibilityBand
  animated?: boolean
}

export function TrustMeter({ score, band, animated = true }: TrustMeterProps) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)
  const bandInfo = bandConfig[band]

  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const motionScore = useMotionValue(0)

  useEffect(() => {
    if (!animated) return
    const controls = animate(motionScore, score, {
      duration: 1.8,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayScore(Math.round(v)),
    })
    return () => controls.stop()
  }, [score, animated, motionScore])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg
          viewBox="0 0 128 128"
          className="w-40 h-40 -rotate-90"
          aria-label={`Credibility score: ${score} out of 100`}
          role="img"
        >
          {/* Track */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
          />
          {/* Progress */}
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${color}90)` }}
          />
          {/* Inner glow ring */}
          <circle
            cx="64"
            cy="64"
            r={radius - 6}
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity="0.08"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span
            className="text-4xl font-black tabular-nums leading-none"
            style={{ color }}
          >
            {displayScore}
          </span>
          <span className="text-xs text-slate-500 font-medium mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Band label */}
      <div className="text-center">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border"
          style={{
            color: bandInfo.color,
            backgroundColor: `${bandInfo.color}15`,
            borderColor: `${bandInfo.color}40`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: bandInfo.color }}
          />
          {bandInfo.label}
        </div>
        <p className="text-xs text-slate-500 mt-2 max-w-[160px] leading-relaxed">
          {bandInfo.description}
        </p>
      </div>
    </div>
  )
}
