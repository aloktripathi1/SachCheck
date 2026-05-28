from __future__ import annotations

import asyncio
import logging
import statistics
from typing import Any

import httpx

from models.schemas import (
    ClaimBusterResult,
    EvidenceBundle,
    GdeltArticle,
    GdeltResult,
    GoogleFactCheckResult,
    GoogleFactCheckReview,
    SourceHealth,
    WebSearchResult,
    WikipediaSummary,
)
from pipeline.web_search import DuckDuckGoClient, GoogleCSEClient

logger = logging.getLogger("sachcheck.evidence")


async def _google_fact_check_search(query: str, api_key: str | None) -> tuple[GoogleFactCheckResult, str]:
    if not api_key:
        return GoogleFactCheckResult(reviews=[]), "skipped_no_key"

    url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    params = {
        "query": query,
        "key": api_key,
        "languageCode": "en",
        "pageSize": 10,
        "reviewPublisherSiteFilter": "politifact.com,snopes.com,factcheck.org,fullfact.org,afp.com",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()

        reviews: list[GoogleFactCheckReview] = []
        for claim in payload.get("claims", []):
            claim_text = claim.get("text", "")
            for review in claim.get("claimReview", []):
                review_url = review.get("url")
                if not review_url:
                    continue
                reviews.append(
                    GoogleFactCheckReview(
                        claim_text=claim_text,
                        verdict=review.get("textualRating", "unrated"),
                        publisher=(review.get("publisher") or {}).get("name", "Unknown"),
                        url=review_url,
                        language_code=review.get("languageCode"),
                        review_date=review.get("reviewDate"),
                    )
                )

        return GoogleFactCheckResult(reviews=reviews), "ok"
    except Exception:
        return GoogleFactCheckResult(reviews=[]), "error"


async def _wikipedia_summaries(entities: list[str]) -> tuple[list[WikipediaSummary], str]:
    if not entities:
        return [], "skipped_no_entities"

    summaries: list[WikipediaSummary] = []
    headers = {"User-Agent": "SachCheck/1.0 (https://github.com/sachcheck; fact-checking tool) python-httpx"}

    async def fetch(entity: str) -> WikipediaSummary | None:
        entity_key = entity.replace(" ", "_")
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{entity_key}"
        try:
            async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    return None
                payload = response.json()

            page_url = ((payload.get("content_urls") or {}).get("desktop") or {}).get("page")
            if not page_url:
                return None

            return WikipediaSummary(
                entity=entity,
                title=payload.get("title", entity),
                summary=payload.get("extract", ""),
                url=page_url,
            )
        except Exception:
            return None

    tasks = [fetch(entity) for entity in entities[:8]]
    fetched = await asyncio.gather(*tasks, return_exceptions=True)
    for item in fetched:
        if isinstance(item, WikipediaSummary):
            summaries.append(item)

    return summaries, "ok" if summaries else "empty"


async def _gdelt_search(query: str) -> tuple[GdeltResult, str]:
    url = "https://api.gdeltproject.org/api/v2/doc/doc"
    params = {
        "query": query,
        "mode": "ArtList",
        "maxrecords": 15,
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()

        articles: list[GdeltArticle] = []
        tones: list[float] = []
        geo: dict[str, int] = {}

        for item in payload.get("articles", []):
            article_url = item.get("url")
            if not article_url:
                continue

            tone = None
            if item.get("seendate"):
                try:
                    tone_value = item.get("tone")
                    if tone_value is not None:
                        tone = float(tone_value)
                        tones.append(tone)
                except Exception:
                    tone = None

            country = item.get("sourcecountry")
            if country:
                geo[country] = geo.get(country, 0) + 1

            articles.append(
                GdeltArticle(
                    title=item.get("title", "Untitled"),
                    url=article_url,
                    source_country=country,
                    tone=tone,
                )
            )

        avg_tone = statistics.fmean(tones) if tones else None
        return (
            GdeltResult(
                articles=articles,
                volume=len(articles),
                avg_tone=avg_tone,
                geo_distribution=geo,
            ),
            "ok",
        )
    except Exception:
        return GdeltResult(articles=[], volume=0, avg_tone=None, geo_distribution={}), "error"


async def _claimbuster_scores(claims: list[str], api_key: str | None) -> tuple[ClaimBusterResult, str]:
    if not api_key:
        return ClaimBusterResult(available=False, scores={}, message="ClaimBuster key unavailable"), "skipped_no_key"

    url = "https://idir-server2.uta.edu/loco-api/score-sentences"
    headers = {"x-api-key": api_key}
    payload = {"input_text": claims}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            body = response.json()

        scores: dict[str, float] = {}
        for idx, row in enumerate(body.get("results", []), start=1):
            claim_id = f"claim_{idx}"
            try:
                scores[claim_id] = float(row.get("score", 0.0))
            except Exception:
                scores[claim_id] = 0.0

        return ClaimBusterResult(available=True, scores=scores), "ok"
    except Exception:
        return ClaimBusterResult(available=False, scores={}, message="ClaimBuster request failed"), "error"


def is_evidence_sufficient(bundle: EvidenceBundle) -> bool:
    """Return True when Tier-1 evidence is rich enough to skip the web search fallback.

    Logic:
    - If GDELT errored (service unavailable), don't count it as a missing signal —
      require only 1 of the remaining 2 sources (FC or Wikipedia).
    - If GDELT is available, require 2 of 3 signals.
    - A Wikipedia result with a long summary (>200 chars) counts as a strong signal.
    """
    has_factcheck = len(bundle.google_fact_check.reviews) > 0
    has_wiki = len(bundle.wikipedia) > 0
    wiki_rich = any(len(w.summary) > 200 for w in bundle.wikipedia)
    has_news_coverage = bundle.gdelt.volume > 3
    gdelt_errored = bundle.source_health.gdelt == "error"

    if gdelt_errored:
        # GDELT unavailable — only 2 signals exist; need just 1 of them
        return has_factcheck or wiki_rich
    return sum([has_factcheck, has_wiki, has_news_coverage]) >= 2


async def _web_search_fallback(
    claim_texts: list[str],
    entities: list[str],
    google_cse_api_key: str | None,
    google_cse_id: str | None,
) -> tuple[list[WebSearchResult], str]:
    """Run Google CSE + DuckDuckGo concurrently; return merged deduplicated results."""
    query = " ".join(claim_texts[:1])  # use first claim as the primary query
    primary_entity = entities[0] if entities else ""

    cse_task = None
    if google_cse_api_key and google_cse_id:
        cse_client = GoogleCSEClient(api_key=google_cse_api_key, cse_id=google_cse_id)
        cse_task = cse_client.search_claim(query, entities)
    else:
        logger.warning("GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID not set — skipping Google CSE fallback")

    ddg_client = DuckDuckGoClient()
    ddg_task = ddg_client.search_claim(query)

    tasks = [ddg_task]
    if cse_task is not None:
        tasks = [cse_task, ddg_task]

    raw = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set[str] = set()
    merged: list[WebSearchResult] = []
    for batch in raw:
        if isinstance(batch, list):
            for r in batch:
                if r.url not in seen:
                    seen.add(r.url)
                    merged.append(r)

    sources_used = []
    if cse_task is not None and not isinstance(raw[0], Exception):
        sources_used.append("google_cse")
    if not isinstance(raw[-1], Exception):
        sources_used.append("duckduckgo")

    health = "ok" if merged else "empty"
    return merged, health


async def gather_evidence(
    query_text: str,
    entities: list[str],
    claim_texts: list[str],
    google_api_key: str | None,
    claimbuster_api_key: str | None,
    google_cse_api_key: str | None = None,
    google_cse_id: str | None = None,
) -> EvidenceBundle:
    tasks = [
        _google_fact_check_search(query_text, google_api_key),
        _wikipedia_summaries(entities),
        _gdelt_search(query_text),
        _claimbuster_scores(claim_texts, claimbuster_api_key),
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    google_result = GoogleFactCheckResult(reviews=[])
    google_health = "error"
    wiki_result: list[WikipediaSummary] = []
    wiki_health = "error"
    gdelt_result = GdeltResult(articles=[], volume=0, avg_tone=None, geo_distribution={})
    gdelt_health = "error"
    claimbuster_result = ClaimBusterResult(available=False, scores={}, message="not_executed")
    claimbuster_health = "error"

    if not isinstance(results[0], Exception):
        google_result, google_health = results[0]
    if not isinstance(results[1], Exception):
        wiki_result, wiki_health = results[1]
    if not isinstance(results[2], Exception):
        gdelt_result, gdelt_health = results[2]
    if not isinstance(results[3], Exception):
        claimbuster_result, claimbuster_health = results[3]

    bundle = EvidenceBundle(
        google_fact_check=google_result,
        wikipedia=wiki_result,
        gdelt=gdelt_result,
        claimbuster=claimbuster_result,
        source_health=SourceHealth(
            google_fact_check=google_health,
            wikipedia=wiki_health,
            gdelt=gdelt_health,
            claimbuster=claimbuster_health,
            web_search="skipped",
        ),
    )

    if not is_evidence_sufficient(bundle):
        try:
            web_results, web_health = await _web_search_fallback(
                claim_texts=claim_texts,
                entities=entities,
                google_cse_api_key=google_cse_api_key,
                google_cse_id=google_cse_id,
            )
            bundle.web_results = web_results
            bundle.source_health.web_search = web_health
        except Exception:
            logger.exception("Web search fallback failed unexpectedly")
            bundle.source_health.web_search = "error"

    return bundle
