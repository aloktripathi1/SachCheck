import { useState, useCallback, useRef } from 'react'
import type { AnalysisState, Claim, ClaimType, EntityTag, VerdictBand, VerdictType, ArticleScore, EvidenceSource, HeuristicSignal } from '../types'
import { createCheck, openStream } from '../lib/api'

const INITIAL_STATE: AnalysisState = {
  step: 'idle',
  claims: [],
  progress: 0,
}

// Maps backend signal keys → display metadata
const SIGNAL_META: Record<string, Omit<HeuristicSignal, 'fired'>> = {
  domain_on_iffy_index:             { label: 'Domain on Iffy Index',            weight: -30, description: 'Listed in 1,300+ unreliable sources database',      category: 'negative' },
  domain_high_mbfc:                 { label: 'High credibility (MBFC)',          weight: 15,  description: 'Rated "High" by Media Bias/Fact Check',             category: 'positive' },
  google_factcheck_false:           { label: 'Fact-checked as FALSE',            weight: -40, description: 'Google Fact Check found a FALSE rating',            category: 'negative' },
  google_factcheck_true:            { label: 'Fact-checked as TRUE',             weight: 20,  description: 'Google Fact Check found a TRUE rating',             category: 'positive' },
  domain_age_lt_6_months:           { label: 'Domain under 6 months old',        weight: -10, description: 'New domains often created for disinformation',       category: 'negative' },
  author_byline_present:            { label: 'Author byline present',            weight: 5,   description: 'Author identity disclosed — transparency signal',    category: 'positive' },
  https_enabled:                    { label: 'HTTPS enabled',                    weight: 2,   description: 'Article served over secure connection',             category: 'positive' },
  high_trust_citations:             { label: 'Cites high-trust sources',         weight: 15,  description: 'References .gov / .edu or tier-1 outlets',          category: 'positive' },
  clickbait_pattern:                { label: 'Clickbait language detected',      weight: -10, description: 'Sensationalist words found in headline',            category: 'negative' },
  excessive_caps:                   { label: 'Excessive capitalisation',         weight: -5,  description: 'Abnormal use of ALL-CAPS in headline',              category: 'negative' },
  headline_body_sentiment_mismatch: { label: 'Headline–body mismatch',           weight: -10, description: 'Headline sentiment contradicts article body',        category: 'negative' },
  high_shares_zero_mainstream:      { label: 'Viral with no mainstream pickup',  weight: -15, description: 'High GDELT volume, zero tier-1 outlet coverage',    category: 'negative' },
}

function inferSourceType(publisher: string): EvidenceSource['type'] {
  const p = publisher.toLowerCase()
  if (p.includes('fact') || p.includes('snopes') || p.includes('politifact') || p.includes('afp') || p.includes('check'))
    return 'fact-checker'
  if (p.includes('wikipedia')) return 'wikipedia'
  if (p.includes('gov') || p.includes('official') || p.includes('ministry')) return 'government'
  if (p.includes('universit') || p.includes('research') || p.includes('journal')) return 'academic'
  return 'news'
}

interface BackendSourceRef {
  publisher: string
  url: string
  title?: string
}

interface BackendClaimVerdict {
  claim_id: string
  verdict: VerdictType
  confidence: number
  explanation: string
  sources: BackendSourceRef[]
  verdict_band?: VerdictBand
  nli_support_score?: number
  nli_refute_score?: number
  supporting_count?: number
  contradicting_count?: number
}

interface BackendArticleVerdict {
  score: number
  band: ArticleScore['band']
  confidence_band: string
  signals_fired: string[]
  claim_verdicts: BackendClaimVerdict[]
}

function buildArticleScore(av: BackendArticleVerdict): ArticleScore {
  const breakdown: ArticleScore['claimBreakdown'] = {
    true: 0, mostly_true: 0, mixed: 0, mostly_false: 0, false: 0, unverified: 0,
  }
  for (const cv of av.claim_verdicts) {
    if (cv.verdict in breakdown) breakdown[cv.verdict]++
  }

  const signals: HeuristicSignal[] = av.signals_fired.map(key => {
    const meta = SIGNAL_META[key] ?? {
      label: key.replace(/_/g, ' '),
      weight: 0,
      description: '',
      category: 'neutral' as const,
    }
    return { ...meta, fired: true }
  })

  const falseClaims = breakdown.false + breakdown.mostly_false
  const trueClaims  = breakdown.true  + breakdown.mostly_true
  const total       = av.claim_verdicts.length

  const summary =
    falseClaims > trueClaims
      ? `This article contains ${falseClaims} refuted claim${falseClaims > 1 ? 's' : ''} out of ${total} analyzed. Treat with significant caution.`
      : trueClaims > falseClaims
      ? `Most analyzed claims are supported by evidence (${trueClaims}/${total}). Minor verification still recommended.`
      : `Mixed credibility — ${trueClaims} supported and ${falseClaims} refuted out of ${total} claims.`

  return {
    score:          av.score,
    band:           av.band,
    confidence:     av.confidence_band,
    signals,
    summary,
    claimBreakdown: breakdown,
  }
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE)
  const esRef      = useRef<EventSource | null>(null)
  const claimsRef  = useRef<Claim[]>([])
  const tokenCount = useRef(0)

  const updateClaim = useCallback((claimId: string, patch: Partial<Claim>) => {
    claimsRef.current = claimsRef.current.map(c => c.id === claimId ? { ...c, ...patch } : c)
    setState(s => ({ ...s, claims: [...claimsRef.current] }))
  }, [])

  const analyze = useCallback(async (input: string) => {
    esRef.current?.close()
    claimsRef.current  = []
    tokenCount.current = 0

    setState({ step: 'extracting', claims: [], progress: 8 })

    // POST /check — get a check_id back
    let checkId: string
    try {
      checkId = await createCheck(input)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setState({ step: 'error', claims: [], progress: 0, error: `Could not reach backend: ${msg}` })
      return
    }

    setState(s => ({ ...s, progress: 18 }))

    // GET /check/{id}/stream — open SSE
    const es = openStream(checkId)
    esRef.current = es

    // One event per check-worthy extracted claim (Claude Haiku phase)
    es.addEventListener('claim_extracted', (e: Event) => {
      const { claim } = JSON.parse((e as MessageEvent).data) as {
        claim: {
          id: string
          text: string
          entity?: string
          entities?: EntityTag[]
          claim_type?: ClaimType
          check_worthy?: boolean
          reason_if_not?: string
        }
      }
      const skeleton: Claim = {
        id: claim.id,
        text: claim.text,
        entity: claim.entity ?? undefined,
        entities: claim.entities ?? undefined,
        claim_type: claim.claim_type ?? undefined,
        check_worthy: claim.check_worthy ?? true,
        reason_if_not: claim.reason_if_not ?? undefined,
      }
      claimsRef.current = [...claimsRef.current, skeleton]
      setState(s => ({
        ...s,
        step: 'extracting',
        claims: [...claimsRef.current],
        progress: Math.min(32, 18 + claimsRef.current.length * 4),
      }))
    })

    // Branch 2: web search lifecycle
    es.addEventListener('web_search_triggered', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data) as { claim_id?: string }
      if (data.claim_id) updateClaim(data.claim_id, { web_search_pending: true })
    })

    es.addEventListener('web_search_complete', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data) as { claim_id?: string }
      if (data.claim_id) updateClaim(data.claim_id, { web_search_pending: false, web_search_used: true })
    })

    // Branch 3: NLI stance scores per claim
    es.addEventListener('nli_scored', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        claim_id: string
        supporting: number
        contradicting: number
        verdict_band: VerdictBand
      }
      updateClaim(data.claim_id, {
        supporting_count:   data.supporting,
        contradicting_count: data.contradicting,
        verdict_band:        data.verdict_band,
      })
      // Roll up nliBreakdown into articleScore if it already exists
      setState(s => {
        if (!s.articleScore) return s
        const prev = s.articleScore.nliBreakdown ?? { supported: 0, refuted: 0, mixed: 0, insufficient: 0 }
        const bandKey: Record<VerdictBand, keyof typeof prev> = {
          SUPPORTED:             'supported',
          REFUTED:               'refuted',
          MIXED:                 'mixed',
          INSUFFICIENT_EVIDENCE: 'insufficient',
        }
        const key = bandKey[data.verdict_band]
        return {
          ...s,
          articleScore: {
            ...s.articleScore,
            nliBreakdown: { ...prev, [key]: prev[key] + 1 },
          },
        }
      })
    })

    // Fires once with source_health (evidence gathered), then many times with stream_token
    es.addEventListener('source_results', (e: Event) => {
      const data = JSON.parse((e as MessageEvent).data) as {
        source_health?: Record<string, string>
        stream_token?: string
      }

      if (data.source_health) {
        setState(s => ({ ...s, step: 'gathering', progress: 48 }))
        setTimeout(() => setState(s => ({ ...s, step: 'scoring',      progress: 64 })), 600)
        setTimeout(() => setState(s => ({ ...s, step: 'synthesizing', progress: 76 })), 1100)
      }

      if (data.stream_token) {
        tokenCount.current++
        setState(s => ({
          ...s,
          step: 'synthesizing',
          progress: Math.min(93, 76 + tokenCount.current * 0.4),
        }))
      }
    })

    // Single event with complete verdicts for all claims + article score
    es.addEventListener('verdict', (e: Event) => {
      const { article_verdict, claims_found, claims_verified, claims_skipped } = JSON.parse((e as MessageEvent).data) as {
        article_verdict: BackendArticleVerdict
        claims_found?: number
        claims_verified?: number
        claims_skipped?: number
      }

      const verdictMap = new Map(article_verdict.claim_verdicts.map(cv => [cv.claim_id, cv]))

      const updatedClaims: Claim[] = claimsRef.current.map(claim => {
        const cv = verdictMap.get(claim.id)
        if (!cv) return claim
        return {
          ...claim,
          verdict:             cv.verdict,
          confidence:          cv.confidence,
          explanation:         cv.explanation,
          verdict_band:        cv.verdict_band ?? claim.verdict_band,
          supporting_count:    cv.supporting_count ?? claim.supporting_count,
          contradicting_count: cv.contradicting_count ?? claim.contradicting_count,
          nli_support_score:   cv.nli_support_score,
          nli_refute_score:    cv.nli_refute_score,
          sources: cv.sources.map((s): EvidenceSource => ({
            name:        s.publisher,
            url:         String(s.url),
            credibility: 'high',
            type:        inferSourceType(s.publisher),
            snippet:     s.title ?? undefined,
          })),
        }
      })

      claimsRef.current = updatedClaims
      const articleScore = buildArticleScore(article_verdict)
      if (claims_found   != null) articleScore.claimsFound    = claims_found
      if (claims_verified != null) articleScore.claimsVerified = claims_verified
      if (claims_skipped  != null) articleScore.claimsSkipped  = claims_skipped

      // Build nliBreakdown from verdict-level band data (authoritative final values)
      const nliBreakdown = { supported: 0, refuted: 0, mixed: 0, insufficient: 0 }
      for (const cv of article_verdict.claim_verdicts) {
        if (cv.verdict_band === 'SUPPORTED')             nliBreakdown.supported++
        else if (cv.verdict_band === 'REFUTED')          nliBreakdown.refuted++
        else if (cv.verdict_band === 'MIXED')            nliBreakdown.mixed++
        else if (cv.verdict_band === 'INSUFFICIENT_EVIDENCE') nliBreakdown.insufficient++
      }
      const hasAnyBand = Object.values(nliBreakdown).some(v => v > 0)
      if (hasAnyBand) articleScore.nliBreakdown = nliBreakdown
      setState(s => ({
        ...s,
        claims:       updatedClaims,
        articleScore,
        progress:     97,
      }))
    })

    // Pipeline finished
    es.addEventListener('done', () => {
      es.close()
      setState(s => ({ ...s, step: 'complete', progress: 100 }))
    })

    // Named error event from backend
    es.addEventListener('error', (e: Event) => {
      if (e instanceof MessageEvent) {
        let msg = 'Verification pipeline failed'
        try { msg = (JSON.parse(e.data) as { message?: string }).message ?? msg } catch { /* */ }
        es.close()
        setState(s => ({ ...s, step: 'error', error: msg }))
      }
    })

    // Network / connection failure
    es.onerror = () => {
      setState(s => {
        if (s.step === 'complete') return s
        es.close()
        return { ...s, step: 'error', error: 'Lost connection to backend. Is it running on port 8000?' }
      })
    }
  }, [])

  const reset = useCallback(() => {
    esRef.current?.close()
    claimsRef.current  = []
    tokenCount.current = 0
    setState(INITIAL_STATE)
  }, [])

  return { state, analyze, reset }
}
