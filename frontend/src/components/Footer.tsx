import { ShieldCheck, Github, ExternalLink, Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <ShieldCheck size={14} className="text-white" />
              </div>
              <span className="font-bold text-white">SachCheck</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              AI-powered claim-level fact verification. Every statement verified against 4 independent sources.
            </p>
          </div>

          {/* Methodology */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Methodology</h3>
            <ul className="space-y-1.5">
              {['Claude Haiku 4.5 for extraction', 'Google Fact Check API', 'Wikipedia REST API', 'GDELT 2.0 for coverage', 'ClaimBuster scoring'].map(item => (
                <li key={item} className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Trust */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Trust & Privacy</h3>
            <ul className="space-y-1.5">
              {[
                'Articles not stored',
                'No user tracking',
                'Transparent scoring',
                'Open-source methodology',
              ].map(item => (
                <li key={item} className="text-xs text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck size={10} className="text-emerald-700" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.04] flex items-center justify-between flex-wrap gap-4">
          <p className="text-xs text-slate-700">
            Built with <Heart size={10} className="inline text-red-800 mx-0.5" /> for the Claude Hackathon 2026
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              className="text-xs text-slate-700 hover:text-slate-400 flex items-center gap-1 transition-colors">
              <Github size={12} /> Source
            </a>
            <a href="#" className="text-xs text-slate-700 hover:text-slate-400 flex items-center gap-1 transition-colors">
              <ExternalLink size={10} /> API Docs
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
