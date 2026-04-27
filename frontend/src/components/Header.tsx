import { motion } from 'framer-motion'
import { ShieldCheck, Github, ExternalLink } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AppView } from '../types'

interface HeaderProps {
  view: AppView
  onNavigate: (view: AppView) => void
}

export function Header({ view, onNavigate }: HeaderProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="glass border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2.5 group focus:outline-none"
              aria-label="SachCheck home"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <ShieldCheck size={17} className="text-white" />
                </div>
                <div className="absolute inset-0 rounded-lg bg-blue-400 blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
              </div>
              <div>
                <span className="text-[15px] font-bold text-white tracking-tight">SachCheck</span>
                <div className="text-[9px] text-slate-500 font-medium tracking-widest uppercase leading-none">
                  Fact Verified
                </div>
              </div>
            </button>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {(['landing', 'analyze'] as AppView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => onNavigate(v)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                    view === v
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )}
                >
                  {v === 'landing' ? 'Home' : 'Analyze'}
                </button>
              ))}
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                aria-label="View source on GitHub"
              >
                <Github size={17} />
              </a>
            </nav>

            {/* CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('analyze')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/30"
            >
              <span>Analyze Article</span>
              <ExternalLink size={13} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
