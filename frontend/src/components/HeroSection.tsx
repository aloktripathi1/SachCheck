import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import {
  ArrowRight, CheckCircle2, XCircle,
  AlertTriangle, Sparkles, Zap
} from 'lucide-react'
import type { AppView } from '../types'

interface HeroSectionProps {
  onNavigate: (view: AppView) => void
}

function FloatingClaimCard({
  verdict,
  text,
  confidence,
  style,
  delay = 0,
}: {
  verdict: 'true' | 'false' | 'mixed'
  text: string
  confidence: number
  style: React.CSSProperties
  delay?: number
}) {
  const configs = {
    true:  { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  icon: <CheckCircle2 size={10} />, label: 'TRUE' },
    false: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   icon: <XCircle size={10} />,      label: 'FALSE' },
    mixed: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  icon: <AlertTriangle size={10} />, label: 'MIXED' },
  }
  const c = configs[verdict]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.7 }}
      style={style}
      className="absolute pointer-events-none"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-xl p-3 w-48 xl:w-52"
        style={{
          background: 'rgba(5,13,26,0.88)',
          border: `1px solid ${c.border}`,
          backdropFilter: 'blur(20px)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${c.border}`,
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest"
            style={{ color: c.color, background: c.bg }}
          >
            {c.icon} {c.label}
          </div>
          <div className="flex-1 h-px" style={{ background: `${c.color}20` }} />
        </div>
        <p className="text-[10px] text-slate-400 leading-snug mb-2">{text}</p>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${confidence}%`, backgroundColor: c.color, opacity: 0.7 }}
            />
          </div>
          <span className="text-[9px] font-bold" style={{ color: c.color }}>{confidence}%</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatBadge({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/[0.08] bg-white/[0.03]"
    >
      <span className="text-xs sm:text-sm font-bold text-white">{value}</span>
      <span className="text-[10px] sm:text-xs text-slate-500">{label}</span>
    </motion.div>
  )
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <section
      ref={ref}
      className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden pt-14 sm:pt-16"
      aria-label="Hero section"
    >
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid-pattern" />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-48"
        style={{ background: 'linear-gradient(to top, #020817, transparent)' }}
      />

      {/* Floating claim cards — only on large screens where they won't overlap text */}
      <div className="hidden lg:block">
        <FloatingClaimCard
          verdict="false"
          text="RBI issued an emergency directive ordering crypto exchanges to freeze withdrawals"
          confidence={88}
          delay={0.6}
          style={{ top: '22%', right: '5%' }}
        />
        <FloatingClaimCard
          verdict="true"
          text="Supreme Court lifted banking ban on crypto in 2020"
          confidence={91}
          delay={0.9}
          style={{ top: '57%', right: '3%' }}
        />
        <FloatingClaimCard
          verdict="mixed"
          text="15 million Indians hold cryptocurrency, ranking India 3rd globally"
          confidence={55}
          delay={1.2}
          style={{ top: '36%', left: '2%' }}
        />
      </div>

      {/* Main content */}
      <motion.div
        style={{ y, opacity }}
        className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-6 text-center"
      >
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-blue-500/30 bg-blue-500/8 mb-6 sm:mb-8"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[10px] sm:text-xs font-semibold text-blue-400 tracking-wide">
            Claim-Level AI Fact Verification
          </span>
          <Sparkles size={10} className="text-blue-400 sm:hidden" />
          <Sparkles size={11} className="text-blue-400 hidden sm:block" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] mb-4 sm:mb-6"
        >
          <span className="text-gradient">Verify Every Claim.</span>
          <br />
          <span className="text-white">Trust Every Source.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base lg:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10 px-2 sm:px-0"
        >
          SachCheck extracts atomic claims from any article and cross-validates each against 4 independent sources —{' '}
          <span className="text-white font-medium">Google Fact Check</span>,{' '}
          <span className="text-white font-medium">Wikipedia</span>,{' '}
          <span className="text-white font-medium">GDELT</span>, and{' '}
          <span className="text-white font-medium">ClaimBuster</span>{' '}
          — delivering per-claim verdicts in{' '}
          <span className="text-emerald-400 font-semibold">38 seconds</span>.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col xs:flex-row sm:flex-row items-center justify-center gap-3 mb-10 sm:mb-12"
        >
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('analyze')}
            className="w-full xs:w-auto flex items-center justify-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/40 transition-colors"
          >
            <Sparkles size={15} />
            Analyze an Article
            <ArrowRight size={14} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('analyze')}
            className="w-full xs:w-auto flex items-center justify-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl border border-white/[0.12] bg-white/[0.04] text-slate-300 font-semibold text-sm sm:text-base hover:bg-white/[0.08] hover:border-white/20 transition-all"
          >
            <Zap size={14} />
            Try Live Demo
          </motion.button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
        >
          <StatBadge value="4"     label="sources verified" delay={0.5} />
          <StatBadge value="38s"   label="average latency"  delay={0.6} />
          <StatBadge value="$0.03" label="per article"      delay={0.7} />
          <StatBadge value="100%"  label="transparent"      delay={0.8} />
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
        aria-hidden="true"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-px h-6 sm:h-8 bg-gradient-to-b from-slate-600 to-transparent rounded-full"
        />
        <span className="text-[9px] sm:text-[10px] text-slate-700 tracking-widest uppercase">Scroll</span>
      </motion.div>
    </section>
  )
}
