import { HeroSection } from '../components/HeroSection'
import { HowItWorks } from '../components/HowItWorks'
import { FeaturesSection } from '../components/FeaturesSection'
import { Footer } from '../components/Footer'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { AppView } from '../types'

interface LandingPageProps {
  onNavigate: (view: AppView) => void
}

function CtaBanner({ onNavigate }: LandingPageProps) {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden border border-white/[0.1] p-10 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(16,185,129,0.06) 100%)',
          }}
        >
          {/* Glow */}
          <div className="absolute inset-0 rounded-3xl"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.15), transparent 70%)' }}
          />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <Sparkles size={11} className="text-blue-400" />
              <span className="text-xs text-blue-400 font-semibold">Ready for Hackathon Demo</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-gradient mb-4">
              Stop Trusting Articles Blindly.
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              Paste any news article and get claim-level verdicts with full evidence trails in under 40 seconds.
            </p>

            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 0 50px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('analyze')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-xl shadow-blue-600/40 transition-colors"
            >
              <Sparkles size={16} />
              Start Fact-Checking
              <ArrowRight size={15} />
            </motion.button>

            <p className="mt-4 text-xs text-slate-600">
              No sign-up required · $0.03 per article · Articles are never stored
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <main>
      <HeroSection onNavigate={onNavigate} />
      <HowItWorks />
      <FeaturesSection />
      <CtaBanner onNavigate={onNavigate} />
      <Footer />
    </main>
  )
}
