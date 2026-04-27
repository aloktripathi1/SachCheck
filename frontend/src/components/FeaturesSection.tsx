import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  ShieldCheck, Layers, Eye, Zap, Scale, Lock
} from 'lucide-react'

const features = [
  {
    icon: Layers,
    title: 'Atomic Claim Extraction',
    description: 'Breaks any article into individual verifiable statements. Not headline-level. Not paragraph-level. Claim-level.',
    color: '#3b82f6',
    highlight: 'vs. domain-level tools',
  },
  {
    icon: ShieldCheck,
    title: '4-Source Cross-Validation',
    description: 'Google Fact Check, Wikipedia, GDELT news archive, and ClaimBuster all queried in parallel. One failed API never kills the run.',
    color: '#10b981',
    highlight: 'Fault tolerant by design',
  },
  {
    icon: Eye,
    title: 'Transparent Scoring',
    description: 'Every heuristic signal is visible: domain age, author byline, citation quality, sentiment mismatch. No black-box scores.',
    color: '#8b5cf6',
    highlight: 'Full explainability',
  },
  {
    icon: Zap,
    title: '38-Second Pipeline',
    description: 'Haiku for extraction (~1s), parallel API calls (~8s), heuristic scoring (~0.2s), Sonnet synthesis (~28s). Fast enough for newsrooms.',
    color: '#f59e0b',
    highlight: 'Prod-ready latency',
  },
  {
    icon: Scale,
    title: 'NewsGuard-Compatible Bands',
    description: 'Green (75-100), Yellow (40-74), Red (0-39), or Insufficient (<2 sources). Familiar scoring that journalists already understand.',
    color: '#ef4444',
    highlight: 'Industry-standard bands',
  },
  {
    icon: Lock,
    title: 'Privacy First',
    description: 'Articles are never stored. No user profiles. No tracking. Text is processed in-flight and discarded. GDPR-compatible by default.',
    color: '#14b8a6',
    highlight: 'Zero data retention',
  },
]

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-labelledby="features-title">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <span className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-3 block">
          Why SachCheck
        </span>
        <h2 id="features-title" className="text-3xl sm:text-4xl font-black text-gradient mb-4">
          Built Different
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          Domain-level tools miss false claims in credible outlets. SachCheck targets the actual statement — not the source.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, idx) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className="group relative p-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
          >
            {/* Icon */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-105"
              style={{
                background: `${feature.color}14`,
                border: `1px solid ${feature.color}25`,
                boxShadow: `0 0 20px ${feature.color}10`,
              }}
            >
              <feature.icon size={21} style={{ color: feature.color }} />
            </div>

            {/* Text */}
            <h3 className="text-sm font-bold text-white mb-2">{feature.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">{feature.description}</p>

            {/* Highlight chip */}
            <span
              className="inline-block text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
              style={{ color: feature.color, background: `${feature.color}12` }}
            >
              {feature.highlight}
            </span>

            {/* Hover glow */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ boxShadow: `inset 0 0 40px ${feature.color}06` }}
            />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
