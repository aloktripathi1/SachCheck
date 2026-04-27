import { useState, useCallback, useRef } from 'react'
import type { AnalysisState, Claim } from '../types'
import { MOCK_CLAIMS, MOCK_ARTICLE_SCORE } from '../lib/mockData'
import { delay } from '../lib/utils'

const INITIAL_STATE: AnalysisState = {
  step: 'idle',
  claims: [],
  progress: 0,
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE)
  const abortRef = useRef(false)

  const analyze = useCallback(async (_input: string) => {
    abortRef.current = false

    // Step 1: Extracting claims
    setState({ step: 'extracting', claims: [], progress: 5 })
    await delay(300)
    setState(s => ({ ...s, progress: 15 }))
    await delay(700)
    setState(s => ({ ...s, progress: 25 }))
    await delay(400)

    if (abortRef.current) return

    // Reveal skeleton claims as they're "extracted"
    const skeletonClaims: Claim[] = MOCK_CLAIMS.map(c => ({
      id: c.id,
      text: c.text,
      entity: c.entity,
    }))

    setState(s => ({ ...s, claims: skeletonClaims, progress: 30 }))
    await delay(300)

    // Step 2: Gathering evidence
    setState(s => ({ ...s, step: 'gathering', progress: 35 }))
    await delay(600)
    setState(s => ({ ...s, progress: 50 }))
    await delay(1200)
    setState(s => ({ ...s, progress: 62 }))
    await delay(600)

    if (abortRef.current) return

    // Step 3: Heuristic scoring
    setState(s => ({ ...s, step: 'scoring', progress: 65 }))
    await delay(250)
    setState(s => ({ ...s, progress: 72 }))
    await delay(150)

    if (abortRef.current) return

    // Step 4: Synthesizing — stream claims one by one
    setState(s => ({ ...s, step: 'synthesizing', progress: 75 }))

    for (let i = 0; i < MOCK_CLAIMS.length; i++) {
      if (abortRef.current) return
      await delay(900)

      const completedClaim = MOCK_CLAIMS[i]

      setState(s => ({
        ...s,
        progress: 75 + ((i + 1) / MOCK_CLAIMS.length) * 20,
        claims: s.claims.map(c =>
          c.id === completedClaim.id ? completedClaim : c
        ),
      }))
    }

    if (abortRef.current) return

    await delay(400)

    // Complete
    setState({
      step: 'complete',
      claims: MOCK_CLAIMS,
      articleScore: MOCK_ARTICLE_SCORE,
      progress: 100,
    })
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    setState(INITIAL_STATE)
  }, [])

  return { state, analyze, reset }
}
