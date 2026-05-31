import { motion } from 'framer-motion'
import {
  ArrowRight, Zap, Scissors, Globe, BarChart3, Sparkles,
  Layers, Shield, Eye, Scale, Lock, CheckCircle2, AlertTriangle, XCircle,
  Image as ImageIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppView } from '../types'

const EASE = [0.2, 0.8, 0.2, 1] as const
const CARD = 'rounded-2xl border border-white/[0.08] bg-white/[0.02]'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500'

type Verdict = 'true' | 'mixed' | 'false'

const VERDICT: Record<Verdict, { label: string; Icon: LucideIcon; text: string; badge: string; border: string; dot: string; bar: string }> = {
  true:  { label: 'Verified', Icon: CheckCircle2,  text: 'text-emerald-400', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400', bar: 'bg-emerald-400' },
  mixed: { label: 'Mixed',    Icon: AlertTriangle, text: 'text-amber-400',   badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',       border: 'border-amber-500/30',   dot: 'bg-amber-400',   bar: 'bg-amber-400'   },
  false: { label: 'False',    Icon: XCircle,       text: 'text-rose-400',    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-400',          border: 'border-rose-500/30',    dot: 'bg-rose-400',    bar: 'bg-rose-400'    },
}

const Ticks = () => (
  <>
    <span className="pointer-events-none absolute left-3 top-3 h-2.5 w-2.5 border-l border-t border-white/20" />
    <span className="pointer-events-none absolute bottom-3 right-3 h-2.5 w-2.5 border-b border-r border-white/20" />
  </>
)

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const m = VERDICT[verdict]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${m.badge}`}>
      <m.Icon className="h-3 w-3" /> {m.label}
    </span>
  )
}

function Meter({ pct, tone }: { pct: number; tone: Verdict }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div className={`h-full rounded-full ${VERDICT[tone].bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: EASE }} />
    </div>
  )
}

function IconTile({ Icon, className = '', size = 'h-[46px] w-[46px]' }: { Icon: LucideIcon; className?: string; size?: string }) {
  return (
    <div className={`grid ${size} place-items-center rounded-xl border border-white/10 bg-white/[0.03] ${className}`}>
      <Icon className="h-5 w-5" />
    </div>
  )
}

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; y?: number; className?: string }> = ({ children, delay = 0, y = 16, className }) => (
  <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55, delay, ease: EASE }}>
    {children}
  </motion.div>
)

function FloatCard({ verdict, claim, pct, className, delay }: { verdict: Verdict; claim: string; pct: number; className: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay, ease: EASE }}
      className={`absolute w-[260px] rounded-2xl border border-white/[0.1] bg-[#0a1322]/90 p-[18px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <VerdictBadge verdict={verdict} />
        <span className="font-mono text-xs text-slate-500">conf {pct}%</span>
      </div>
      <p className="mb-3 text-[13.5px] leading-snug text-slate-400">{claim}</p>
      <Meter pct={pct} tone={verdict} />
    </motion.div>
  )
}

function Hero({ go }: { go: (v: AppView, demo?: boolean) => void }) {
  return (
    <section className="relative pb-20 pt-24">
      <div className="relative mx-auto max-w-[1200px] px-6">
        <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block">
          <FloatCard verdict="false" pct={88} delay={0.15} className="right-[-10px] top-6" claim="RBI ordered crypto exchanges to freeze all withdrawals." />
          <FloatCard verdict="true"  pct={96} delay={0.4}  className="right-[84px] top-[196px]" claim="Supreme Court lifted the banking ban on crypto in 2020." />
          <FloatCard verdict="mixed" pct={55} delay={0.62} className="right-[8px] top-[368px]"  claim="15 million Indians hold crypto — third globally." />
        </div>

        <div className="relative z-10 max-w-[720px]">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-[#4f8dfd]/30 bg-[#4f8dfd]/10 px-3.5 py-1.5 font-mono text-xs text-[#4f8dfd]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4f8dfd] shadow-[0_0_0_3px_rgba(79,141,253,0.2)]" /> Claim-level AI fact verification
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
            className="mt-6 font-serif text-[clamp(46px,7vw,92px)] font-medium leading-[0.98] tracking-tight text-slate-100">
            Verify every claim.<br />
            <span className="italic text-[#4f8dfd]">Trust</span> every source.
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
            className="mt-6 max-w-[560px] text-[19px] leading-relaxed text-slate-400">
            SachCheck breaks any article into atomic claims and cross-examines each against{' '}
            <strong className="font-semibold text-slate-100">four independent sources</strong> — delivering per-claim verdicts with full evidence trails in <span className="font-mono text-slate-100">~38s</span>.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24, ease: EASE }} className="mt-9 flex flex-wrap gap-3">
            <button onClick={() => go('analyze')}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#4f8dfd] px-6 py-4 text-base font-semibold text-white shadow-[0_10px_28px_-10px_rgba(79,141,253,0.6)] ring-1 ring-inset ring-white/25 transition-colors hover:bg-[#6aa0ff]">
              <Sparkles className="h-[18px] w-[18px]" /> Analyze an article <ArrowRight className="h-[17px] w-[17px]" />
            </button>
            <button onClick={() => go('analyze', true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-base font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
              <Zap className="h-[17px] w-[17px]" /> Try live demo
            </button>
          </motion.div>

        </div>
      </div>
    </section>
  )
}

const PIPELINE = [
  { n: 1, tag: 'AI Model',  Icon: Scissors,  title: 'Claim Extraction',      color: 'text-[#4f8dfd]',    body: 'Claude Haiku parses the article and isolates every atomic, verifiable statement — filtering out opinion, questions, and hyperbole.',                                              model: 'Claude Haiku 4.5',   latency: '~1s'   },
  { n: 2, tag: 'Evidence',  Icon: Globe,     title: 'Multi-Source Evidence',  color: 'text-violet-400',   body: 'Each claim is queried in parallel against Google Fact Check, Wikipedia, GDELT, and ClaimBuster — fault-tolerant by design.',                                                  model: '4 APIs · parallel',  latency: '~8s'   },
  { n: 3, tag: 'Scoring',   Icon: BarChart3, title: 'Heuristic Scoring',      color: 'text-amber-400',    body: 'A rule-based engine fires 11 credibility signals — domain reputation, citation quality, sensationalism — normalized to 0–100.',                                              model: 'Python engine',      latency: '~0.2s' },
  { n: 4, tag: 'Synthesis', Icon: Sparkles,  title: 'Verdict Synthesis',      color: 'text-emerald-400',  body: 'Claude Sonnet reasons over all evidence and signals to produce per-claim verdicts with transparent chain-of-thought.',                                                       model: 'Claude Sonnet 4.5',  latency: '~28s'  },
]

function Pipeline() {
  return (
    <section className="border-t border-white/[0.08] py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal className="mb-14 text-center">
          <div className={EYEBROW}>Under the hood</div>
          <h2 className="mt-3.5 whitespace-nowrap font-serif text-[clamp(22px,3.5vw,52px)] font-medium tracking-tight text-slate-100">A four-step verification pipeline</h2>
          <p className="mt-4 text-[17px] text-slate-400">Every article runs the same rigorous path — extract, gather, score, synthesize.</p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className={`group relative h-full ${CARD} p-[22px] transition-transform hover:-translate-y-1`}>
                <Ticks />
                <div className="mb-6 flex items-start justify-between">
                  <IconTile Icon={s.Icon} className={s.color} />
                  <span className={`font-mono text-[13px] font-semibold ${s.color}`}>0{s.n}</span>
                </div>
                <div className={`mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] ${s.color}`}>{s.tag}</div>
                <h3 className="mb-2.5 text-[17.5px] font-semibold text-slate-100">{s.title}</h3>
                <p className="min-h-[92px] text-[13.5px] leading-relaxed text-slate-400">{s.body}</p>
                <div className="flex items-center justify-between border-t border-dashed border-white/10 py-2.5 font-mono text-[12.5px]">
                  <span className="text-slate-500">model</span><span className="font-medium text-slate-200">{s.model}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-white/10 py-2.5 font-mono text-[12.5px]">
                  <span className="text-slate-500">latency</span><span className={`font-medium ${s.color}`}>{s.latency}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  { Icon: Layers,    color: 'text-[#4f8dfd]',   title: 'Atomic claim extraction',   tag: 'vs. domain-level tools',      body: 'Breaks any article into individual verifiable statements. Not headline-level. Not paragraph-level. Claim-level.' },
  { Icon: Shield,    color: 'text-emerald-400',  title: '4-source cross-validation', tag: 'fault tolerant by design',    body: 'Google Fact Check, Wikipedia, GDELT, and ClaimBuster queried in parallel. One failed API never kills the run.' },
  { Icon: Eye,       color: 'text-violet-400',   title: 'Transparent scoring',       tag: 'full explainability',         body: 'Every heuristic signal is visible: domain age, author byline, citation quality, sentiment mismatch. No black-box scores.' },
  { Icon: Zap,       color: 'text-amber-400',    title: '38-second pipeline',        tag: 'newsroom-ready latency',      body: 'Haiku extraction, parallel API calls, heuristic scoring, Sonnet synthesis — fast enough to fact-check live.' },
  { Icon: Scale,     color: 'text-rose-400',     title: 'NewsGuard-compatible bands',tag: 'industry-standard',           body: 'Green (75–100), Yellow (40–74), Red (0–39). Familiar credibility scoring that journalists already understand.' },
  { Icon: Lock,      color: 'text-emerald-400',  title: 'Privacy first',             tag: 'zero data retention',         body: 'Articles are never stored. No user profiles. No tracking. Text is processed in-flight and discarded. GDPR-compatible.' },
]

function Why() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal className="mb-12 text-center">
          <div className={EYEBROW}>Why SachCheck</div>
          <h2 className="mt-3.5 whitespace-nowrap font-serif text-[clamp(20px,3.5vw,52px)] font-medium tracking-tight text-slate-100">Built to find the lie <span className="italic text-[#4f8dfd]">inside</span> the truth</h2>
          <p className="mt-4 text-[17px] text-slate-400">Domain-level tools miss false claims in credible outlets. SachCheck targets the statement — not the source.</p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className={`h-full ${CARD} p-7 transition-transform hover:-translate-y-1`}>
                <IconTile Icon={f.Icon} className={`mb-5 ${f.color}`} />
                <h3 className="mb-2.5 text-[18px] font-semibold text-slate-100">{f.title}</h3>
                <p className="mb-4 text-[14px] leading-relaxed text-slate-400">{f.body}</p>
                <div className={`font-mono text-[10px] uppercase tracking-[0.18em] ${f.color}`}>{f.tag}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA({ go }: { go: (v: AppView, demo?: boolean) => void }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(700px_320px_at_50%_-20%,rgba(79,141,253,0.14),transparent)] px-10 py-[72px] text-center">
            <Ticks />
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#4f8dfd]/30 bg-[#4f8dfd]/10 px-3.5 py-1.5 font-mono text-xs text-[#4f8dfd]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4f8dfd]" /> Ready when you are
            </div>
            <h2 className="mx-auto max-w-[720px] font-serif text-[clamp(36px,5vw,64px)] font-medium tracking-tight text-slate-100">Stop trusting articles <span className="italic text-[#4f8dfd]">blindly.</span></h2>
            <p className="mx-auto mt-5 max-w-[520px] text-[18px] text-slate-400">Paste any news article and get claim-level verdicts with full evidence trails in under 40 seconds.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={() => go('analyze')} className="inline-flex items-center gap-2.5 rounded-xl bg-[#4f8dfd] px-6 py-4 text-base font-semibold text-white shadow-[0_10px_28px_-10px_rgba(79,141,253,0.6)] ring-1 ring-inset ring-white/25 transition-colors hover:bg-[#6aa0ff]">
                <Sparkles className="h-[18px] w-[18px]" /> Start fact-checking <ArrowRight className="h-[17px] w-[17px]" />
              </button>
              <button onClick={() => go('image')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-base font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
                <ImageIcon className="h-[17px] w-[17px]" /> Check an image
              </button>
            </div>
            <p className="mt-6 font-mono text-xs text-slate-500">No sign-up · $0.03 per article · Articles are never stored</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function LandingPage({ go }: { go: (v: AppView, demo?: boolean) => void }) {
  return (
    <div>
      <Hero go={go} />
      <Pipeline />
      <Why />
      <CTA go={go} />
    </div>
  )
}
