from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import quote_plus

import httpx

from models.schemas import WebSearchResult

logger = logging.getLogger("sachcheck.web_search")

_CSE_SEMAPHORE = asyncio.Semaphore(2)


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
        main_entity = entities[0] if entities else ""
        # Strip inline entity tags like [PERSON:Elon Musk] → Elon Musk
        clean_claim = re.sub(r"\[(?:PERSON|ORG|LOC|DATE|QUANTITY):([^\]]+)\]", r"\1", claim)
        snippet = clean_claim[:30].rstrip()

        queries = [
            f"{main_entity} {clean_claim[:60]}".strip(),
            f'fact-check OR debunked OR false "{snippet}"',
            f'site:reuters.com OR site:apnews.com "{main_entity}"' if main_entity else f'site:reuters.com OR site:apnews.com {snippet}',
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
        clean = re.sub(r"\[(?:PERSON|ORG|LOC|DATE|QUANTITY):([^\]]+)\]", r"\1", claim)
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
