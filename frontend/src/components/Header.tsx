import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Github, ExternalLink, Menu, X } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AppView } from '../types'

interface HeaderProps {
  view: AppView
  onNavigate: (view: AppView) => void
}

export function Header({ view, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems: { v: AppView; label: string; badge?: string }[] = [
    { v: 'landing', label: 'Home' },
    { v: 'analyze', label: 'Analyze' },
    { v: 'image',   label: 'Image Check', badge: 'NEW' },
  ]

  const handleNav = (v: AppView) => {
    onNavigate(v)
    setMobileOpen(false)
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="glass border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <button
              onClick={() => handleNav('landing')}
              className="flex items-center gap-2 sm:gap-2.5 group focus:outline-none flex-shrink-0"
              aria-label="SachCheck home"
            >
              <div className="relative">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <ShieldCheck size={15} className="text-white sm:hidden" />
                  <ShieldCheck size={17} className="text-white hidden sm:block" />
                </div>
                <div className="absolute inset-0 rounded-lg bg-blue-400 blur-md opacity-0 group-hover:opacity-30 transition-opacity" />
              </div>
              <div>
                <span className="text-[14px] sm:text-[15px] font-bold text-white tracking-tight">SachCheck</span>
                <div className="text-[8px] sm:text-[9px] text-slate-500 font-medium tracking-widest uppercase leading-none hidden xs:block">
                  Fact Verified
                </div>
              </div>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ v, label, badge }) => (
                <button
                  key={v}
                  onClick={() => handleNav(v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                    view === v
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )}
                >
                  {label}
                  {badge && (
                    <span className="text-[8px] font-bold text-blue-400 border border-blue-500/30 bg-blue-500/10 px-1 py-0.5 rounded tracking-wide">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
              <a
                href="https://github.com/Khushi-Choudhary11/SachCheck"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-200 focus:outline-none"
                aria-label="View source on GitHub"
              >
                <Github size={17} />
              </a>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Desktop CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleNav('analyze')}
                className="hidden sm:flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/30"
              >
                <span>Analyze Article</span>
                <ExternalLink size={13} />
              </motion.button>

              {/* Mobile CTA (icon only) */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleNav('analyze')}
                className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-blue-600/30"
              >
                Analyze
              </motion.button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-white/[0.06]"
            >
              <div className="px-4 py-3 space-y-1">
                {navItems.map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => handleNav(v)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      view === v
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    )}
                  >
                    {label}
                  </button>
                ))}
                <a
                  href="https://github.com/Khushi-Choudhary11/SachCheck"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                >
                  <Github size={15} />
                  GitHub
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  )
}
