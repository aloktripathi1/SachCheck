from __future__ import annotations

import csv
import math
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

from models.schemas import EvidenceBundle, HeuristicScore


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
IFFY_INDEX_CSV = DATA_DIR / "iffy_index.csv"
MBFC_CSV = DATA_DIR / "mbfc_domains.csv"


@dataclass(frozen=True)
class DomainReputation:
    iffy_domains: set[str]
    mbfc_high_domains: set[str]


_reputation_cache: DomainReputation | None = None


def load_domain_reputation() -> DomainReputation:
    global _reputation_cache
    if _reputation_cache is not None:
        return _reputation_cache

    iffy_domains: set[str] = set()
    mbfc_high_domains: set[str] = set()

    if IFFY_INDEX_CSV.exists():
        with IFFY_INDEX_CSV.open("r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                domain = (row.get("domain") or "").strip().lower()
                if domain:
                    iffy_domains.add(domain)

    if MBFC_CSV.exists():
        with MBFC_CSV.open("r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                domain = (row.get("domain") or "").strip().lower()
                rating = (row.get("rating") or "").strip().lower()
                if domain and rating in {"high", "very high", "vh"}:
                    mbfc_high_domains.add(domain)

    _reputation_cache = DomainReputation(iffy_domains=iffy_domains, mbfc_high_domains=mbfc_high_domains)
    return _reputation_cache


def _extract_domain(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        return host.replace("www.", "") if host else None
    except Exception:
        return None


async def _domain_age_signal(source_url: str | None) -> tuple[int, list[str]]:
    if not source_url:
        return 0, []

    try:
        domain = _extract_domain(source_url)
        if not domain:
            return 0, []

        rdap_url = f"https://rdap.org/domain/{domain}"
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(rdap_url)
            if response.status_code != 200:
                return 0, []
            payload = response.json()

        events = payload.get("events", [])
        registration_date = None
        for event in events:
            if str(event.get("eventAction", "")).lower() in {"registration", "registered"}:
                registration_date = event.get("eventDate")
                break

        if not registration_date:
            return 0, []

        registered_at = datetime.fromisoformat(registration_date.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        age_days = (now - registered_at).days
        if age_days < 180:
            return -10, ["domain_age_lt_6_months"]
    except Exception:
        return 0, []

    return 0, []


def _headline_body_sentiment_mismatch(title: str | None, body: str) -> bool:
    if not title:
        return False

    positive = {"success", "improve", "growth", "wins", "booming", "progress"}
    negative = {"crisis", "fail", "collapse", "fraud", "scam", "corrupt", "violence"}

    def sentiment_score(text: str) -> int:
        score = 0
        words = re.findall(r"\b[a-z]+\b", text.lower())
        for word in words:
            if word in positive:
                score += 1
            if word in negative:
                score -= 1
        return score

    title_score = sentiment_score(title)
    body_score = sentiment_score(body[:1200])
    return title_score * body_score < 0


def _clickbait_penalty(title: str | None, body: str) -> tuple[int, list[str]]:
    candidate = (title or body.splitlines()[0] if body else "")
    if not candidate:
        return 0, []

    score = 0
    fired: list[str] = []

    if re.search(r"\b(shocking|you won'?t believe|must see|exclusive|huge|explosive)\b", candidate, flags=re.I):
        score -= 10
        fired.append("clickbait_pattern")

    if sum(1 for char in candidate if char.isupper()) > max(10, len(candidate) * 0.45):
        score -= 5
        fired.append("excessive_caps")

    return score, fired


def _citation_bonus(body: str) -> tuple[int, list[str]]:
    domains = re.findall(r"https?://([A-Za-z0-9.-]+)", body)
    score = 0
    fired: list[str] = []

    tier_a = {"reuters.com", "apnews.com", "bbc.com", "nytimes.com", "wsj.com"}

    for domain in domains:
        normalized = domain.lower().replace("www.", "")
        if normalized.endswith(".gov") or normalized.endswith(".edu") or normalized in tier_a:
            score += 5

    if score:
        capped = min(15, score)
        fired.append("high_trust_citations")
        return capped, fired
    return 0, []


def _google_review_signal(evidence: EvidenceBundle) -> tuple[int, list[str]]:
    score = 0
    fired: list[str] = []

    for review in evidence.google_fact_check.reviews:
        verdict = review.verdict.lower()
        if "false" in verdict:
            score -= 40
            fired.append("google_factcheck_false")
        elif "true" in verdict:
            score += 20
            fired.append("google_factcheck_true")

    return score, fired


def _high_shares_zero_mainstream(body: str, evidence: EvidenceBundle) -> tuple[int, list[str]]:
    if not re.search(r"\b(viral|shared|retweet|trend|trending)\b", body, flags=re.I):
        return 0, []

    mainstream_hosts = {"reuters.com", "apnews.com", "bbc.com", "nytimes.com", "wsj.com"}
    gdelt_hosts = set()
    for article in evidence.gdelt.articles:
        parsed = urlparse(str(article.url))
        gdelt_hosts.add(parsed.netloc.lower().replace("www.", ""))

    has_mainstream = bool(mainstream_hosts.intersection(gdelt_hosts))
    if evidence.gdelt.volume > 0 and not has_mainstream:
        return -15, ["high_shares_zero_mainstream"]

    return 0, []


async def score_article(
    source_url: str | None,
    title: str | None,
    article_text: str,
    author_byline_present: bool,
    evidence: EvidenceBundle,
) -> HeuristicScore:
    reputation = load_domain_reputation()

    raw_score = 0
    signals: list[str] = []

    domain = _extract_domain(source_url)
    if domain and domain in reputation.iffy_domains:
        raw_score -= 30
        signals.append("domain_on_iffy_index")

    if domain and domain in reputation.mbfc_high_domains:
        raw_score += 15
        signals.append("domain_high_mbfc")

    review_score, review_signals = _google_review_signal(evidence)
    raw_score += review_score
    signals.extend(review_signals)

    domain_age_delta, domain_age_signals = await _domain_age_signal(source_url)
    raw_score += domain_age_delta
    signals.extend(domain_age_signals)

    if author_byline_present:
        raw_score += 5
        signals.append("author_byline_present")

    if source_url and source_url.lower().startswith("https://"):
        raw_score += 2
        signals.append("https_enabled")

    citation_delta, citation_signals = _citation_bonus(article_text)
    raw_score += citation_delta
    signals.extend(citation_signals)

    clickbait_delta, clickbait_signals = _clickbait_penalty(title, article_text)
    raw_score += clickbait_delta
    signals.extend(clickbait_signals)

    if _headline_body_sentiment_mismatch(title, article_text):
        raw_score -= 10
        signals.append("headline_body_sentiment_mismatch")

    social_delta, social_signals = _high_shares_zero_mainstream(article_text, evidence)
    raw_score += social_delta
    signals.extend(social_signals)

    final_score = int(round((1 / (1 + math.exp(-(raw_score / 20.0)))) * 100))
    independent_signal_count = len(set(signals))

    return HeuristicScore(
        raw_score=raw_score,
        final_score=final_score,
        signals_fired=signals,
        independent_signal_count=independent_signal_count,
    )
