import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from './components/Header'
import { LandingPage } from './pages/LandingPage'
import { AnalyzePage } from './pages/AnalyzePage'
import { ImageCheckPage } from './pages/ImageCheckPage'
import type { AppView } from './types'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

export default function App() {
  const [view, setView] = useState<AppView>('landing')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view])

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">
      <Header view={view} onNavigate={setView} />

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3 }}
        >
          {view === 'landing' ? (
            <LandingPage onNavigate={setView} />
          ) : view === 'analyze' ? (
            <AnalyzePage onNavigate={setView} />
          ) : (
            <ImageCheckPage onNavigate={setView} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
