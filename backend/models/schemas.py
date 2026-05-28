from __future__ import annotations

from enum import Enum
from typing import Any, Literal
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class Claim(BaseModel):
    id: str = Field(pattern=r"^claim_\d+$")
    text: str = Field(min_length=3)
    entity: str | None = None


class EntityTag(BaseModel):
    text: str
    type: str  # PERSON | ORG | LOC | DATE | QUANTITY


class ClaimType(str, Enum):
    STATISTICAL = "statistical"
    HISTORICAL = "historical"
    ATTRIBUTED_QUOTE = "attributed_quote"
    BIOGRAPHICAL = "biographical"
    SCIENTIFIC = "scientific"
    CAUSAL = "causal"
    POLICY = "policy"


class AtomicClaim(Claim):
    """SAFE-style atomic claim with inline entity tags and check-worthiness flag.

    Inherits id/text/entity from Claim so existing pipeline code (synthesizer
    fallback, image pipeline) continues to work without modification.
    """

    entities: list[EntityTag] = Field(default_factory=list)
    claim_type: ClaimType = ClaimType.HISTORICAL
    check_worthy: bool = True
    reason_if_not: str | None = None


class ExtractionResult(BaseModel):
    claims: list[AtomicClaim]
    skipped_claims: list[AtomicClaim] = Field(default_factory=list)
    entities: list[str]


class SourceRef(BaseModel):
    publisher: str
    url: HttpUrl
    title: str | None = None


class GoogleFactCheckReview(BaseModel):
    claim_text: str
    verdict: str
    publisher: str
    url: HttpUrl
    language_code: str | None = None
    review_date: str | None = None


class GoogleFactCheckResult(BaseModel):
    reviews: list[GoogleFactCheckReview]


class WikipediaSummary(BaseModel):
    entity: str
    title: str
    summary: str
    url: HttpUrl | None = None


class GdeltArticle(BaseModel):
    title: str
    url: HttpUrl
    source_country: str | None = None
    tone: float | None = None


class GdeltResult(BaseModel):
    articles: list[GdeltArticle]
    volume: int = 0
    avg_tone: float | None = None
    geo_distribution: dict[str, int] = Field(default_factory=dict)


class ClaimBusterResult(BaseModel):
    available: bool
    scores: dict[str, float] = Field(default_factory=dict)
    message: str | None = None


class WebSearchResult(BaseModel):
    url: str
    title: str
    description: str
    domain: str
    tier: Literal["A", "B", "C"]
    source: Literal["google_cse", "duckduckgo"]

    @classmethod
    def from_url(cls, url: str, title: str, description: str, source: Literal["google_cse", "duckduckgo"]) -> "WebSearchResult":
        try:
            domain = urlparse(url).netloc.lstrip("www.")
        except Exception:
            domain = ""
        return cls(url=url, title=title, description=description, domain=domain, tier=_compute_tier(domain), source=source)


_TIER_A_DOMAINS: frozenset[str] = frozenset({
    "reuters.com", "apnews.com", "bbc.com", "theguardian.com",
    "nytimes.com", "washingtonpost.com", "economist.com",
    "nature.com", "science.org", "who.int", "cdc.gov", "nih.gov",
})

_TIER_B_KEYWORDS: frozenset[str] = frozenset({
    "news", "post", "times", "herald", "tribune", "gazette",
    "journal", "press", "wire", "daily", "report",
})


def _compute_tier(domain: str) -> Literal["A", "B", "C"]:
    if domain in _TIER_A_DOMAINS:
        return "A"
    if any(kw in domain for kw in _TIER_B_KEYWORDS):
        return "B"
    return "C"


class SourceHealth(BaseModel):
    google_fact_check: str
    wikipedia: str
    gdelt: str
    claimbuster: str
    web_search: str = "skipped"


class EvidenceBundle(BaseModel):
    google_fact_check: GoogleFactCheckResult
    wikipedia: list[WikipediaSummary]
    gdelt: GdeltResult
    claimbuster: ClaimBusterResult
    source_health: SourceHealth
    web_results: list[WebSearchResult] = Field(default_factory=list)


class HeuristicScore(BaseModel):
    raw_score: int
    final_score: int = Field(ge=0, le=100)
    signals_fired: list[str]
    independent_signal_count: int = Field(ge=0)


class ClaimVerdictLabel(str, Enum):
    TRUE = "true"
    MOSTLY_TRUE = "mostly_true"
    MIXED = "mixed"
    MOSTLY_FALSE = "mostly_false"
    FALSE = "false"
    UNVERIFIED = "unverified"


class ClaimVerdict(BaseModel):
    claim_id: str
    verdict: ClaimVerdictLabel
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str
    sources: list[SourceRef]


class ArticleBand(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"
    INSUFFICIENT = "insufficient"


class ArticleVerdict(BaseModel):
    score: int = Field(ge=0, le=100)
    band: ArticleBand
    confidence_band: str
    signals_fired: list[str]
    claim_verdicts: list[ClaimVerdict]


class ScrapeResult(BaseModel):
    source_url: HttpUrl
    title: str | None = None
    description: str | None = None
    first_paragraph: str | None = None
    text_for_analysis: str
    author_byline_present: bool = False


class CheckRequest(BaseModel):
    input: str = Field(min_length=3)


class CheckCreateResponse(BaseModel):
    check_id: UUID


class PipelineInput(BaseModel):
    raw_input: str
    source_url: HttpUrl | None = None
    article_text: str
    title: str | None = None
    author_byline_present: bool = False


class StreamEventType(str, Enum):
    CLAIM_EXTRACTED = "claim_extracted"
    SOURCE_RESULTS = "source_results"
    WEB_SEARCH_TRIGGERED = "web_search_triggered"
    WEB_SEARCH_COMPLETE = "web_search_complete"
    VERDICT = "verdict"
    DONE = "done"
    ERROR = "error"


class StreamEvent(BaseModel):
    event: StreamEventType
    data: dict[str, Any]
