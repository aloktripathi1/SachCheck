export type VerdictType =
  | 'true'
  | 'mostly_true'
  | 'mixed'
  | 'mostly_false'
  | 'false'
  | 'unverified';

export type CredibilityBand = 'green' | 'yellow' | 'red' | 'insufficient';

export type SourceType = 'fact-checker' | 'wikipedia' | 'news' | 'academic' | 'government';

export type SourceCredibility = 'high' | 'medium' | 'low';

export interface EvidenceSource {
  name: string;
  url: string;
  credibility: SourceCredibility;
  type: SourceType;
  snippet?: string;
}

export type ClaimType =
  | 'statistical'
  | 'historical'
  | 'attributed_quote'
  | 'biographical'
  | 'scientific'
  | 'causal'
  | 'policy';

export interface EntityTag {
  text: string;
  type: 'PERSON' | 'ORG' | 'LOC' | 'DATE' | 'QUANTITY';
}

// ── Branch 3 / 4: NLI & 4-band verdict types ─────────────────────────────────

export type VerdictBand =
  | 'SUPPORTED'
  | 'REFUTED'
  | 'MIXED'
  | 'INSUFFICIENT_EVIDENCE';

export type NLIStance = 'supports' | 'contradicts' | 'neutral';

export type EntityType = 'PERSON' | 'ORG' | 'LOC' | 'DATE' | 'QUANTITY';

export interface Entity {
  text: string;
  type: EntityType;
}

export interface EvidencePassage {
  id: number;
  text: string;
  source_name: string;
  url?: string;
  stance: NLIStance;
  confidence: number;
  tier: 'A' | 'B' | 'C';
}

export interface Claim {
  id: string;
  text: string;
  entity?: string;
  // Atomic decomposition fields (Branch 1)
  entities?: EntityTag[];
  claim_type?: ClaimType;
  check_worthy?: boolean;
  reason_if_not?: string;
  // Verdict fields (populated after synthesis)
  verdict?: VerdictType;
  confidence?: number;
  explanation?: string;
  sources?: EvidenceSource[];
  reasoning?: string;
  // NLI fields (Branch 3)
  verdict_band?: VerdictBand;
  supporting_count?: number;
  contradicting_count?: number;
  nli_support_score?: number;
  nli_refute_score?: number;
  // Web search fields (Branch 2)
  web_search_used?: boolean;
  web_search_pending?: boolean;
}

export interface HeuristicSignal {
  label: string;
  weight: number;
  fired: boolean;
  description: string;
  category: 'positive' | 'negative' | 'neutral';
}

export interface ArticleScore {
  score: number;
  band: CredibilityBand;
  confidence: string;
  signals: HeuristicSignal[];
  summary: string;
  claimBreakdown: {
    true: number;
    mostly_true: number;
    mixed: number;
    mostly_false: number;
    false: number;
    unverified: number;
  };
  // Atomic decomposition counters (Branch 1)
  claimsFound?: number;
  claimsVerified?: number;
  claimsSkipped?: number;
  // NLI band counters (Branch 3)
  nliBreakdown?: {
    supported: number;
    refuted: number;
    mixed: number;
    insufficient: number;
  };
}

export type PipelineStep =
  | 'idle'
  | 'extracting'
  | 'gathering'
  | 'scoring'
  | 'synthesizing'
  | 'complete'
  | 'error';

export interface AnalysisState {
  step: PipelineStep;
  claims: Claim[];
  articleScore?: ArticleScore;
  progress: number;
  error?: string;
}

export type AppView = 'landing' | 'analyze' | 'image';

// ── Image check types ─────────────────────────────────────────────────────────

export type ImageVerdict =
  | 'Likely Authentic'
  | 'Potentially Misleading'
  | 'Likely False'
  | 'Unverifiable'
  | 'Satire Risk';

export interface ManipulationSignal {
  signal: string;
  label: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  fired: boolean;
  weight: number;
  category: string;
}

export interface ImageScore {
  verdict_label: ImageVerdict;
  overall_score: number;
  band: CredibilityBand;
  confidence: number;
  reasoning: string;
  safer_context: string;
  extracted_text: string;
  ocr_confidence: number;
  ocr_language: string;
  ocr_method: string;
  extracted_claims: Array<{ id: string; text: string; entity?: string }>;
  manipulation_signals: ManipulationSignal[];
  signal_score: number;
  evidence_summary: {
    google_fact_check_reviews: Array<{ claim: string; verdict: string; publisher: string }>;
    wikipedia_summaries: Array<{ entity: string; title: string }>;
    gdelt_volume: number;
  };
}

export type ImagePipelineStep =
  | 'idle'
  | 'preprocessing'
  | 'ocr_running'
  | 'ocr_complete'
  | 'extracting'
  | 'gathering'
  | 'signals'
  | 'synthesizing'
  | 'complete'
  | 'error';

export interface ImageAnalysisState {
  step: ImagePipelineStep;
  ocrText?: string;
  ocrConfidence?: number;
  ocrLanguage?: string;
  ocrMethod?: string;
  claims: Array<{ id: string; text: string; entity?: string }>;
  signals: ManipulationSignal[];
  signalScore?: number;
  imageScore?: ImageScore;
  progress: number;
  error?: string;
}
