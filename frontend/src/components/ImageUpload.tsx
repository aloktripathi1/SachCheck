import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Image as ImageIcon, X, Camera, Clipboard, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

interface ImageUploadProps {
  onFile: (file: File) => void
  isAnalyzing: boolean
  previewUrl: string | null
  onClear: () => void
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'
const MAX_MB = 10

function validateFile(file: File): string | null {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']
  if (!ok.includes(file.type)) return `Unsupported format. Use JPG, PNG, or WebP.`
  if (file.size > MAX_MB * 1024 * 1024) return `Image too large (max ${MAX_MB} MB).`
  return null
}

export function ImageUpload({ onFile, isAnalyzing, previewUrl, onClear }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const handleFile = useCallback((file: File) => {
    const err = validateFile(file)
    if (err) { setError(err); return }
    setError(null)
    onFile(file)
  }, [onFile])

  // Paste from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const img = items.find(i => i.type.startsWith('image/'))
      if (img) {
        const file = img.getAsFile()
        if (file) handleFile(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // If we have a preview, show it
  if (previewUrl) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] bg-white/[0.02]">
        <img
          src={previewUrl}
          alt="Uploaded image preview"
          className="w-full max-h-[340px] object-contain bg-black/20"
        />
        {/* Scan line animation when analyzing */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/40" />
              {/* Animated scan line */}
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                style={{ boxShadow: '0 0 12px 4px rgba(59,130,246,0.6)' }}
                animate={{ top: ['5%', '95%', '5%'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Corner brackets */}
              {[
                'top-3 left-3 border-t-2 border-l-2',
                'top-3 right-3 border-t-2 border-r-2',
                'bottom-3 left-3 border-b-2 border-l-2',
                'bottom-3 right-3 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-6 h-6 border-blue-400/80 ${cls}`} />
              ))}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <span className="text-xs text-blue-300 bg-black/60 px-3 py-1 rounded-full tracking-wide font-medium">
                  Scanning image…
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isAnalyzing && (
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all"
            aria-label="Remove image"
          >
            <X size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Main drop zone */}
      <motion.div
        ref={dropRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        animate={dragging ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200',
          'flex flex-col items-center justify-center py-12 px-6 text-center',
          dragging
            ? 'border-blue-400/60 bg-blue-500/8'
            : 'border-white/[0.12] bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]',
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload image for fact-checking"
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      >
        <AnimatePresence mode="wait">
          {dragging ? (
            <motion.div key="drag" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center mb-4 mx-auto">
                <Upload size={24} className="text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-blue-400">Drop to analyse</p>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center mb-4 mx-auto">
                <ImageIcon size={24} className="text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">
                Drag & drop an image
              </p>
              <p className="text-xs text-slate-500 mb-3">
                or click to browse · paste from clipboard
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {['Screenshot', 'WhatsApp', 'Tweet', 'Instagram', 'Poster'].map(tag => (
                  <span key={tag} className="text-[10px] text-slate-600 border border-white/[0.06] px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onInputChange}
          aria-hidden="true"
        />
      </motion.div>

      {/* Action row: camera capture (mobile) + clipboard hint */}
      <div className="flex gap-2">
        {/* Camera — mobile only */}
        <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-xs font-medium text-slate-400 cursor-pointer transition-all sm:hidden">
          <Camera size={14} />
          Camera
          <input
            type="file"
            accept={ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={onInputChange}
          />
        </label>

        <button
          onClick={async () => {
            try {
              const items = await navigator.clipboard.read()
              for (const item of items) {
                const imgType = item.types.find(t => t.startsWith('image/'))
                if (imgType) {
                  const blob = await item.getType(imgType)
                  handleFile(new File([blob], 'paste.png', { type: imgType }))
                  return
                }
              }
              setError('No image found in clipboard. Try Ctrl+V / ⌘V while focused here.')
            } catch {
              setError('Paste an image directly with Ctrl+V / ⌘V.')
            }
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-xs font-medium text-slate-400 transition-all"
        >
          <Clipboard size={14} />
          Paste Screenshot
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/20"
          >
            <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-slate-700 text-center">
        Supports JPG, PNG, WebP · Max 10 MB · No images stored
      </p>
    </div>
  )
}
