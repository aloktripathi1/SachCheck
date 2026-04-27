import type { Claim, ArticleScore } from '../types'

export const MOCK_ARTICLE_TEXT = `RBI Issues Emergency Directive on Cryptocurrency Holdings as Bitcoin Surges Past ₹1 Crore

The Reserve Bank of India (RBI) issued an emergency directive late Tuesday night, ordering all cryptocurrency exchanges operating in India to freeze user withdrawals within 48 hours, according to an anonymous source within the banking regulator. The directive, reportedly signed by Governor Sanjay Malhotra, comes as Bitcoin crossed the ₹1 crore mark for the first time in Indian markets.

Over 15 million Indians currently hold cryptocurrency assets, making India the third-largest crypto market globally. The Supreme Court previously lifted a complete banking ban on crypto in 2020, but this new directive could effectively reverse that ruling.

Industry experts warn this could trigger a massive sell-off. "We've never seen regulatory action at this speed," said one analyst who wished to remain anonymous. The Indian government has not officially commented on the directive.`

export const MOCK_CLAIMS: Claim[] = [
  {
    id: 'claim_1',
    text: 'RBI issued an emergency directive ordering cryptocurrency exchanges to freeze user withdrawals within 48 hours',
    entity: 'Reserve Bank of India',
    verdict: 'false',
    confidence: 0.88,
    explanation: 'No such directive exists in RBI\'s official communications or press releases. The RBI\'s official website and verified press releases contain no record of this emergency directive as of the analysis date.',
    reasoning: 'Cross-referenced against RBI official press releases (rbi.org.in), Google Fact Check database, and major Indian news outlets. PolitiFact India and AFP Fact Check both flagged similar claims as fabricated. GDELT shows high virality with zero credible outlet coverage.',
    sources: [
      { name: 'RBI Official', url: 'https://rbi.org.in', credibility: 'high', type: 'government', snippet: 'No such directive found in official communications' },
      { name: 'AFP Fact Check', url: 'https://factcheck.afp.com', credibility: 'high', type: 'fact-checker', snippet: 'Claim rated FALSE — no verifiable source' },
      { name: 'Reuters', url: 'https://reuters.com', credibility: 'high', type: 'news', snippet: 'Reuters found no evidence of emergency directive' },
    ],
  },
  {
    id: 'claim_2',
    text: 'Bitcoin crossed ₹1 crore per coin for the first time in Indian markets',
    entity: 'Bitcoin',
    verdict: 'mostly_true',
    confidence: 0.79,
    explanation: 'Bitcoin did briefly cross ₹1 crore on multiple Indian exchanges during the period in question. Price data from CoinDCX and WazirX confirms this milestone, though the exact timing varies by exchange.',
    reasoning: 'Market data from major Indian exchanges confirms the price milestone. Wikipedia entry for Bitcoin price history aligns with this figure. Minor discrepancy: some exchanges showed the crossing 2 days prior to the reported date.',
    sources: [
      { name: 'CoinDCX Data', url: 'https://coindcx.com', credibility: 'medium', type: 'news', snippet: 'BTC reached ₹1,02,34,500 on April 23' },
      { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Bitcoin', credibility: 'medium', type: 'wikipedia', snippet: 'Bitcoin price history confirms all-time highs' },
      { name: 'Economic Times', url: 'https://economictimes.com', credibility: 'high', type: 'news', snippet: 'Bitcoin hits ₹1 crore milestone on Indian exchanges' },
    ],
  },
  {
    id: 'claim_3',
    text: 'Over 15 million Indians currently hold cryptocurrency assets, making India the third-largest crypto market globally',
    entity: 'India',
    verdict: 'mixed',
    confidence: 0.55,
    explanation: 'The "15 million" figure is plausible but varies significantly across sources (12M–22M). The "third-largest globally" ranking is disputed — India ranks between 2nd and 5th depending on the metric used.',
    reasoning: 'Chainalysis 2024 Global Crypto Adoption Index places India at #1 for adoption, not #3. KYC-verified user count from exchanges suggests 12–18M range. The broad discrepancy in methodology makes this claim partially accurate.',
    sources: [
      { name: 'Chainalysis Report', url: 'https://chainalysis.com', credibility: 'high', type: 'academic', snippet: 'India ranks #1 in crypto adoption index, not #3' },
      { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Cryptocurrency_in_India', credibility: 'medium', type: 'wikipedia', snippet: 'Estimates range from 12M to 22M holders' },
    ],
  },
  {
    id: 'claim_4',
    text: 'The Supreme Court previously lifted a complete banking ban on cryptocurrency in 2020',
    entity: 'Supreme Court of India',
    verdict: 'mostly_true',
    confidence: 0.91,
    explanation: 'This is substantially accurate. The Supreme Court of India did strike down the RBI circular in March 2020 that had banned banks from servicing crypto businesses. The ruling is well-documented.',
    reasoning: 'Verified against Supreme Court order (Internet and Mobile Association of India v. RBI), Wikipedia, and multiple legal databases. The order was indeed in 2020, and it did lift the effective ban, though not every nuance of the claim is precise.',
    sources: [
      { name: 'Supreme Court of India', url: 'https://sci.gov.in', credibility: 'high', type: 'government', snippet: 'Order in IAMAI v. RBI confirmed March 4, 2020' },
      { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Cryptocurrency_in_India', credibility: 'medium', type: 'wikipedia', snippet: 'SC struck down RBI ban in March 2020' },
      { name: 'LiveLaw', url: 'https://livelaw.in', credibility: 'high', type: 'news', snippet: 'Supreme Court quashes RBI circular' },
    ],
  },
  {
    id: 'claim_5',
    text: 'Governor Sanjay Malhotra signed the emergency directive',
    entity: 'Sanjay Malhotra',
    verdict: 'unverified',
    confidence: 0.31,
    explanation: 'While Sanjay Malhotra is the current RBI Governor (confirmed), the claim that he signed this specific directive cannot be verified as the underlying directive itself cannot be confirmed. Attribution cannot be assessed.',
    reasoning: 'Wikipedia and RBI website confirm Sanjay Malhotra as current RBI Governor. However, since the primary claim (the directive) cannot be verified, attributing authorship to him is also unverifiable. No official document or leaked copy has surfaced.',
    sources: [
      { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Sanjay_Malhotra', credibility: 'medium', type: 'wikipedia', snippet: 'Sanjay Malhotra is confirmed as RBI Governor' },
      { name: 'RBI Official', url: 'https://rbi.org.in', credibility: 'high', type: 'government', snippet: 'No directive found to attribute' },
    ],
  },
]

export const MOCK_ARTICLE_SCORE: ArticleScore = {
  score: 31,
  band: 'red',
  confidence: '7/10 ± 1, High confidence',
  summary: 'This article contains at least one clearly fabricated claim (the RBI emergency directive) presented as fact with a fake anonymous source. While some peripheral claims are accurate (Bitcoin price milestone, Supreme Court ruling), the core premise is misinformation. The use of unverifiable anonymous sources and sensationalist framing are strong red flags.',
  claimBreakdown: {
    true: 0,
    mostly_true: 2,
    mixed: 1,
    mostly_false: 0,
    false: 1,
    unverified: 1,
  },
  signals: [
    { label: 'Core claim fabricated', weight: -40, fired: true, description: 'Primary claim contradicted by official sources', category: 'negative' },
    { label: 'Anonymous sourcing only', weight: -15, fired: true, description: 'Key claims attributed only to unnamed sources', category: 'negative' },
    { label: 'High virality, no mainstream coverage', weight: -15, fired: true, description: 'Trending socially but not covered by major outlets', category: 'negative' },
    { label: 'HTTPS secure domain', weight: 2, fired: true, description: 'Article served over secure connection', category: 'positive' },
    { label: 'Accurate historical facts present', weight: 10, fired: true, description: 'Some verifiable historical claims included', category: 'positive' },
    { label: 'Sensationalist language detected', weight: -8, fired: true, description: '"Emergency directive" framing without basis', category: 'negative' },
    { label: 'No author byline', weight: -5, fired: true, description: 'Author identity not disclosed', category: 'negative' },
  ],
}

export const DEMO_ARTICLE_SNIPPETS = [
  {
    title: 'Try this viral misinformation example',
    text: MOCK_ARTICLE_TEXT,
    label: 'Demo Article',
  },
]
