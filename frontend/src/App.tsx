import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Nav } from './components/Header'
import { Footer } from './components/Footer'
import { LandingPage } from './pages/LandingPage'
import { AnalyzePage } from './pages/AnalyzePage'
import { ImageCheckPage } from './pages/ImageCheckPage'
import type { AppView } from './types'

export default function App() {
  const [view, setView] = useState<AppView>('landing')
  const [autoRun, setAutoRun] = useState(false)

  const go = (next: AppView, demo = false) => {
    setAutoRun(demo)
    setView(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020817] font-sans text-slate-100 antialiased">
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: 'radial-gradient(1200px 720px at 78% -8%, rgba(79,141,253,0.07), transparent 60%), radial-gradient(900px 600px at 8% 8%, rgba(16,185,129,0.05), transparent 55%)' }} />
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%)', WebkitMaskImage: 'radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%)' }} />

      <div className="relative z-10">
        <Nav view={view} go={go} />
        <AnimatePresence mode="wait">
          <motion.main key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {view === 'landing' && <LandingPage go={go} />}
            {view === 'analyze' && <AnalyzePage key={autoRun ? 'demo' : 'fresh'} autoRun={autoRun} go={go} />}
            {view === 'image' && <ImageCheckPage go={go} />}
          </motion.main>
        </AnimatePresence>
        {view === 'landing' && <Footer go={go} />}
      </div>
    </div>
  )
}
