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

export interface Claim {
  id: string;
  text: string;
  entity?: string;
  verdict?: VerdictType;
  confidence?: number;
  explanation?: string;
  sources?: EvidenceSource[];
  reasoning?: string;
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

export type AppView = 'landing' | 'analyze';
