from __future__ import annotations

import asyncio
import logging
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus

import httpx

from models.schemas import WebSearchResult

logger = logging.getLogger("sachcheck.web_search")

_CSE_SEMAPHORE = asyncio.Semaphore(2)


def _strip_tags(text: str) -> str:
    """Remove inline entity tags like [PERSON:Elon Musk] → Elon Musk."""
    return re.sub(r"\[(?:PERSON|ORG|LOC|DATE|QUANTITY):([^\]]+)\]", r"\1", text)


def extract_verb_phrase(claim: str) -> str:
    """Extract main verb + up to 3 following words from a claim string.

    Tries spaCy first (already installed); falls back to a simple
    heuristic that takes words after the first recognised entity marker.
    """
    clean = _strip_tags(claim).strip()
    try:
        import spacy  # type: ignore
        try:
            nlp = spacy.load("en_core_web_sm")
        except OSError:
            nlp = spacy.load("en_core_web_md")
        doc = nlp(clean[:200])
        for token in doc:
            if token.pos_ == "VERB" and not token.is_stop:
                phrase_tokens = [token] + [t for t in token.rights][:3]
                phrase = " ".join(t.text for t in phrase_tokens).strip()
                if phrase:
                    return phrase
    except Exception:
        pass

    # Fallback: split on first bracket-free word boundary after a capital-word run
    words = clean.split()
    # skip leading proper-noun-like words (Title Case), take up to 4 after
    skip = 0
    for w in words:
        if w[0].isupper() if w else False:
            skip += 1
        else:
            break
    return " ".join(words[skip: skip + 4])


def _build_query(claim: str, entities: list[str]) -> str:
    """Combine all entity texts + verb phrase into a single news-optimised query."""
    clean_claim = _strip_tags(claim)
    verb_phrase = extract_verb_phrase(clean_claim)
    parts = [*entities, verb_phrase] if verb_phrase else entities
    return " ".join(parts).strip()[:120]


class GoogleNewsRSSClient:
    BASE_URL = "https://news.google.com/rss/search"

    async def search(self, query: str) -> list[WebSearchResult]:
        params = {
            "q": query,
            "hl": "en-IN",
            "gl": "IN",
            "ceid": "IN:en",
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(self.BASE_URL, params=params)
                resp.raise_for_status()
                root = ET.fromstring(resp.text)
        except Exception as exc:
            logger.debug("Google News RSS failed: %s", exc)
            return []

        results: list[WebSearchResult] = []
        ns = ""
        for item in root.findall(f".//{ns}item")[:8]:
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link")  or "").strip()
            desc  = (item.findtext("description") or "").strip()
            # Google News RSS wraps real URL in <link>; strip Google redirect if present
            if link and "news.google.com" in link:
                # actual article link is often the guid
                guid = (item.findtext("guid") or "").strip()
                if guid and guid.startswith("http") and "news.google.com" not in guid:
                    link = guid
            if not link:
                continue
            results.append(
                WebSearchResult.from_url(
                    url=link,
                    title=title,
                    description=re.sub(r"<[^>]+>", "", desc)[:300],
                    source="google_news_rss",
                )
            )
        return results


class GoogleCSEClient:
    BASE_URL = "https://www.googleapis.com/customsearch/v1"

    def __init__(self, api_key: str, cse_id: str) -> None:
        self._api_key = api_key
        self._cse_id = cse_id

    async def _single_query(self, client: httpx.AsyncClient, query: str) -> list[WebSearchResult]:
        params = {
            "key": self._api_key,
            "cx": self._cse_id,
            "q": query,
            "num": 5,
        }
        try:
            async with _CSE_SEMAPHORE:
                resp = await client.get(self.BASE_URL, params=params, timeout=5.0)
                resp.raise_for_status()
            items = resp.json().get("items") or []
            return [
                WebSearchResult.from_url(
                    url=item.get("link", ""),
                    title=item.get("title", ""),
                    description=item.get("snippet", ""),
                    source="google_cse",
                )
                for item in items
                if item.get("link")
            ]
        except Exception as exc:
            logger.debug("GoogleCSE query failed: %s", exc)
            return []

    async def search_claim(self, claim: str, entities: list[str]) -> list[WebSearchResult]:
        query = _build_query(claim, entities)
        clean_claim = _strip_tags(claim)
        snippet = clean_claim[:30].rstrip()

        queries = [
            query,
            f'fact-check OR debunked OR false "{snippet}"',
            f'site:reuters.com OR site:apnews.com {query[:60]}',
        ]

        async with httpx.AsyncClient(timeout=5.0) as client:
            raw = await asyncio.gather(
                *[self._single_query(client, q) for q in queries],
                return_exceptions=True,
            )

        seen: set[str] = set()
        merged: list[WebSearchResult] = []
        for batch in raw:
            if isinstance(batch, list):
                for r in batch:
                    if r.url not in seen:
                        seen.add(r.url)
                        merged.append(r)
        return merged


class DuckDuckGoClient:
    BASE_URL = "https://api.duckduckgo.com/"

    async def search_claim(self, claim: str) -> list[WebSearchResult]:
        clean = _strip_tags(claim)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    self.BASE_URL,
                    params={"q": clean, "format": "json", "no_html": "1", "skip_disambig": "1"},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.debug("DuckDuckGo request failed: %s", exc)
            return []

        results: list[WebSearchResult] = []

        abstract_url = data.get("AbstractURL", "")
        abstract_text = data.get("AbstractText", "")
        if abstract_url and abstract_text:
            results.append(
                WebSearchResult.from_url(
                    url=abstract_url,
                    title=data.get("Heading", clean[:60]),
                    description=abstract_text[:300],
                    source="duckduckgo",
                )
            )

        for topic in (data.get("RelatedTopics") or [])[:4]:
            if not isinstance(topic, dict):
                continue
            url = topic.get("FirstURL", "")
            text = topic.get("Text", "")
            if url and text:
                results.append(
                    WebSearchResult.from_url(
                        url=url,
                        title=text[:80],
                        description=text[:300],
                        source="duckduckgo",
                    )
                )

        return results[:5]
