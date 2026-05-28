import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Scissors, Globe2, BarChart3, Sparkles } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Scissors,
    title: 'Claim Extraction',
    description: 'Claude Haiku 4.5 parses the article and identifies every atomic, verifiable factual statement — filtering out opinions, questions, and hyperbole.',
    model: 'Claude Haiku 4.5',
    latency: '~1 second',
    color: '#3b82f6',
    tag: 'AI Model',
  },
  {
    number: '02',
    icon: Globe2,
    title: 'Multi-Source Evidence',
    description: 'Each claim is simultaneously queried against Google Fact Check, Wikipedia, GDELT news archive, and ClaimBuster — all in parallel with fault tolerance.',
    model: '4 APIs in parallel',
    latency: '~8 seconds',
    color: '#8b5cf6',
    tag: 'Evidence Layer',
  },
  {
    number: '03',
    icon: BarChart3,
    title: 'Heuristic Scoring',
    description: 'A rule-based Python engine fires 11 credibility signals — domain reputation, citation quality, sensationalism patterns, viral coverage ratio — and normalizes to a 0-100 score.',
    model: 'Python engine',
    latency: '~0.2 seconds',
    color: '#f59e0b',
    tag: 'Scoring',
  },
  {
    number: '04',
    icon: Sparkles,
    title: 'Verdict Synthesis',
    description: 'Claude Sonnet 4.5 reasons over all evidence and heuristic signals to generate per-claim verdicts with confidence scores and transparent chain-of-thought explanations.',
    model: 'Claude Sonnet 4.5',
    latency: '~28 seconds',
    color: '#10b981',
    tag: 'AI Synthesis',
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" aria-labelledby="how-it-works-title">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
        className="text-center mb-16"
      >
        <span className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-3 block">
          Under the Hood
        </span>
        <h2 id="how-it-works-title" className="text-3xl sm:text-4xl font-black text-gradient mb-4">
          A 4-Step Verification Pipeline
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          Every article goes through the same rigorous process — atomic claim extraction,
          parallel evidence gathering, heuristic scoring, and AI synthesis.
        </p>
      </motion.div>

      {/* Desktop horizontal timeline */}
      <div className="hidden lg:flex items-start gap-0">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1
          return (
            <div key={step.number} className="flex items-start flex-1">
              {/* Step column */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + idx * 0.15, duration: 0.6 }}
                className="flex flex-col items-center text-center w-full"
              >
              {/* Icon box */}
              <div
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6 z-10"
                style={{
                  background: `linear-gradient(135deg, ${step.color}18, ${step.color}08)`,
                  border: `1px solid ${step.color}30`,
                  boxShadow: `0 0 30px ${step.color}12`,
                }}
              >
                <step.icon size={28} style={{ color: step.color }} />
                <div
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{ background: step.color, color: '#020817' }}
                >
                  {idx + 1}
                </div>
              </div>

              <div
                className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full mb-2"
                style={{ color: step.color, background: `${step.color}15` }}
              >
                {step.tag}
              </div>

              <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">{step.description}</p>

              <div className="mt-auto flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <span className="text-[10px] text-slate-600">Model</span>
                  <span className="text-[10px] font-semibold text-slate-400">{step.model}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <span className="text-[10px] text-slate-600">Latency</span>
                  <span className="text-[10px] font-semibold" style={{ color: step.color }}>{step.latency}</span>
                </div>
              </div>
              </motion.div>

              {/* Connector segment between this step and the next — only between steps */}
              {!isLast && (
                <div className="flex-shrink-0 w-8 mt-9 mx-1 h-px relative overflow-hidden self-start">
                  <div className="absolute inset-0"
                    style={{ background: `linear-gradient(to right, ${step.color}25, ${steps[idx+1].color}25)` }}
                  />
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scaleX: 0 }}
                    animate={isInView ? { scaleX: 1 } : {}}
                    transition={{ duration: 0.6, delay: 0.4 + idx * 0.2, ease: 'easeOut' }}
                    style={{ originX: 0, background: `linear-gradient(to right, ${step.color}55, ${steps[idx+1].color}55)` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile stacked layout */}
      <div className="lg:hidden space-y-4">
        {steps.map((step, idx) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className="flex gap-4 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${step.color}18`, border: `1px solid ${step.color}30` }}
            >
              <step.icon size={22} style={{ color: step.color }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black" style={{ color: step.color }}>{step.number}</span>
                <h3 className="text-sm font-bold text-white">{step.title}</h3>
                <span className="ml-auto text-[9px] font-semibold" style={{ color: step.color }}>{step.latency}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
