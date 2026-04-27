import { useCallback, useRef, useState } from 'react'
import { createImageCheck, openImageStream } from '../lib/api'
import type { ImageAnalysisState, ImagePipelineStep, ManipulationSignal } from '../types'

const STEP_PROGRESS: Record<ImagePipelineStep, number> = {
  idle: 0,
  preprocessing: 8,
  ocr_running: 18,
  ocr_complete: 32,
  extracting: 45,
  gathering: 60,
  signals: 75,
  synthesizing: 88,
  complete: 100,
  error: 0,
}

const INITIAL: ImageAnalysisState = {
  step: 'idle',
  claims: [],
  signals: [],
  progress: 0,
}

export function useImageAnalysis() {
  const [state, setState] = useState<ImageAnalysisState>(INITIAL)
  const esRef = useRef<EventSource | null>(null)

  const reset = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    setState(INITIAL)
  }, [])

  const analyze = useCallback(async (file: File) => {
    esRef.current?.close()
    setState({ ...INITIAL, step: 'preprocessing', progress: 8 })

    let checkId: string
    try {
      checkId = await createImageCheck(file)
    } catch (err) {
      setState(s => ({ ...s, step: 'error', error: (err as Error).message }))
      return
    }

    const es = openImageStream(checkId)
    esRef.current = es

    const setStep = (step: ImagePipelineStep) =>
      setState(s => ({ ...s, step, progress: STEP_PROGRESS[step] }))

    es.addEventListener('preprocessing',  () => setStep('preprocessing'))
    es.addEventListener('ocr_running',    () => setStep('ocr_running'))

    es.addEventListener('ocr_complete', (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { ocr: { text: string; confidence: number; language: string; method: string } }
      setState(s => ({
        ...s,
        step: 'ocr_complete',
        progress: STEP_PROGRESS.ocr_complete,
        ocrText: d.ocr.text,
        ocrConfidence: d.ocr.confidence,
        ocrLanguage: d.ocr.language,
        ocrMethod: d.ocr.method,
      }))
    })

    es.addEventListener('extracting', () => setStep('extracting'))

    es.addEventListener('claim_found', (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { claim: { id: string; text: string; entity?: string } }
      setState(s => ({ ...s, claims: [...s.claims, d.claim] }))
    })

    es.addEventListener('gathering',      () => setStep('gathering'))
    es.addEventListener('evidence_ready', () => {})  // already covered by gathering step

    es.addEventListener('signals', () => setStep('signals'))

    es.addEventListener('signals_ready', (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { signals: ManipulationSignal[]; signal_score: number }
      setState(s => ({ ...s, signals: d.signals, signalScore: d.signal_score }))
    })

    es.addEventListener('synthesizing', () => setStep('synthesizing'))

    es.addEventListener('verdict', (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { verdict: ImageAnalysisState['imageScore'] }
      setState(s => ({
        ...s,
        step: 'complete',
        progress: 100,
        imageScore: d.verdict,
        signals: d.verdict?.manipulation_signals ?? s.signals,
        signalScore: d.verdict?.signal_score ?? s.signalScore,
        claims: d.verdict?.extracted_claims ?? s.claims,
        ocrText: d.verdict?.extracted_text ?? s.ocrText,
        ocrConfidence: d.verdict?.ocr_confidence ?? s.ocrConfidence,
        ocrLanguage: d.verdict?.ocr_language ?? s.ocrLanguage,
        ocrMethod: d.verdict?.ocr_method ?? s.ocrMethod,
      }))
    })

    es.addEventListener('error', (e: MessageEvent) => {
      let msg = 'Analysis failed'
      try { msg = (JSON.parse(e.data) as { message?: string }).message ?? msg } catch { /* */ }
      setState(s => ({ ...s, step: 'error', error: msg }))
      es.close()
    })

    es.addEventListener('done', () => {
      setState(s => s.step !== 'error' ? { ...s, step: 'complete', progress: 100 } : s)
      es.close()
    })

    es.onerror = () => {
      setState(s => s.step !== 'complete' ? { ...s, step: 'error', error: 'Connection lost' } : s)
      es.close()
    }
  }, [])

  return { state, analyze, reset }
}
