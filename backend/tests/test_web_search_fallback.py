"""Tests for Branch 2: web search fallback (feat/web-search-fallback)."""
from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import respx
import httpx

from models.schemas import (
    ClaimBusterResult,
    EvidenceBundle,
    GdeltResult,
    GoogleFactCheckResult,
    GoogleFactCheckReview,
    SourceHealth,
    WebSearchResult,
    WikipediaSummary,
    _compute_tier,
)
from pipeline.evidence import is_evidence_sufficient, gather_evidence
from pipeline.web_search import DuckDuckGoClient, GoogleCSEClient


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_bundle(
    fc_reviews: int = 0,
    wiki_items: int = 0,
    wiki_summary_len: int = 10,
    gdelt_volume: int = 0,
    gdelt_health: str = "ok",
) -> EvidenceBundle:
    reviews = [
        GoogleFactCheckReview(
            claim_text="test", verdict="true",
            publisher="Snopes", url="https://snopes.com/test",
        )
        for _ in range(fc_reviews)
    ]
    wiki_summary = "x" * wiki_summary_len
    wiki = [
        WikipediaSummary(entity="Test", title="Test", summary=wiki_summary, url="https://en.wikipedia.org/wiki/Test")
        for _ in range(wiki_items)
    ]
    return EvidenceBundle(
        google_fact_check=GoogleFactCheckResult(reviews=reviews),
        wikipedia=wiki,
        gdelt=GdeltResult(articles=[], volume=gdelt_volume),
        claimbuster=ClaimBusterResult(available=False),
        source_health=SourceHealth(
            google_fact_check="ok", wikipedia="ok",
            gdelt=gdelt_health, claimbuster="skipped_no_key",
        ),
    )


# ── 1. Sufficiency gate: True when 2+ Tier-1 sources have results ─────────────

class TestSufficiencyGate(unittest.TestCase):
    def test_sufficient_fc_and_wiki(self):
        bundle = _make_bundle(fc_reviews=1, wiki_items=1, gdelt_volume=0)
        self.assertTrue(is_evidence_sufficient(bundle))

    def test_sufficient_fc_and_gdelt(self):
        bundle = _make_bundle(fc_reviews=1, wiki_items=0, gdelt_volume=5)
        self.assertTrue(is_evidence_sufficient(bundle))

    def test_sufficient_wiki_and_gdelt(self):
        bundle = _make_bundle(fc_reviews=0, wiki_items=2, gdelt_volume=10)
        self.assertTrue(is_evidence_sufficient(bundle))

    def test_sufficient_all_three(self):
        bundle = _make_bundle(fc_reviews=2, wiki_items=3, gdelt_volume=8)
        self.assertTrue(is_evidence_sufficient(bundle))

    # ── False cases ──────────────────────────────────────────────────────────

    def test_insufficient_all_empty(self):
        bundle = _make_bundle(fc_reviews=0, wiki_items=0, gdelt_volume=0)
        self.assertFalse(is_evidence_sufficient(bundle))

    def test_insufficient_only_fc(self):
        bundle = _make_bundle(fc_reviews=1, wiki_items=0, gdelt_volume=0)
        self.assertFalse(is_evidence_sufficient(bundle))

    def test_insufficient_only_wiki(self):
        bundle = _make_bundle(fc_reviews=0, wiki_items=1, gdelt_volume=0)
        self.assertFalse(is_evidence_sufficient(bundle))

    def test_insufficient_gdelt_below_threshold(self):
        # gdelt_volume must be > 3; exactly 3 is still insufficient
        bundle = _make_bundle(fc_reviews=0, wiki_items=0, gdelt_volume=3)
        self.assertFalse(is_evidence_sufficient(bundle))

    def test_sufficient_when_gdelt_errors_and_wiki_rich(self):
        # GDELT errored (service down) + rich Wikipedia → sufficient (no fallback needed)
        bundle = _make_bundle(fc_reviews=0, wiki_items=1, wiki_summary_len=250, gdelt_health="error")
        self.assertTrue(is_evidence_sufficient(bundle))

    def test_insufficient_when_gdelt_errors_and_wiki_short(self):
        # GDELT errored + Wikipedia has only a stub summary → still insufficient
        bundle = _make_bundle(fc_reviews=0, wiki_items=1, wiki_summary_len=50, gdelt_health="error")
        self.assertFalse(is_evidence_sufficient(bundle))


# ── 2. gather_evidence: web search NOT called when evidence is sufficient ─────

class TestWebSearchNotCalledWhenSufficient(unittest.IsolatedAsyncioTestCase):
    @respx.mock
    async def test_no_web_search_when_sufficient(self):
        # Mock all Tier-1 endpoints
        respx.get("https://factchecktools.googleapis.com/v1alpha1/claims:search").mock(
            return_value=httpx.Response(200, json={"claims": [
                {"text": "test claim", "claimReview": [{"url": "https://snopes.com/test", "textualRating": "True", "publisher": {"name": "Snopes"}}]}
            ]})
        )
        respx.get(url__regex=r"https://en\.wikipedia\.org/.*").mock(
            return_value=httpx.Response(200, json={
                "title": "Test", "extract": "Test summary",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Test"}},
            })
        )
        respx.get("https://api.gdeltproject.org/api/v2/doc/doc").mock(
            return_value=httpx.Response(200, json={"articles": [
                {"url": f"https://news.example.com/{i}", "title": f"Article {i}", "sourcecountry": "US"}
                for i in range(5)
            ]})
        )
        # DDG and CSE should NOT be called — if they are, respx will raise
        respx.get("https://api.duckduckgo.com/").mock(side_effect=AssertionError("DDG should not be called"))
        respx.get("https://www.googleapis.com/customsearch/v1").mock(side_effect=AssertionError("CSE should not be called"))

        bundle = await gather_evidence(
            query_text="test query",
            entities=["Test Entity"],
            claim_texts=["test claim"],
            google_api_key="fake-fc-key",
            claimbuster_api_key=None,
            google_cse_api_key="fake-cse-key",
            google_cse_id="fake-cse-id",
        )

        self.assertEqual(bundle.source_health.web_search, "skipped")
        self.assertEqual(bundle.web_results, [])


# ── 3. gather_evidence: web search IS called when evidence is insufficient ────

class TestWebSearchCalledWhenInsufficient(unittest.IsolatedAsyncioTestCase):
    @respx.mock
    async def test_web_search_fires_when_empty_tier1(self):
        # All Tier-1 sources return empty
        respx.get("https://factchecktools.googleapis.com/v1alpha1/claims:search").mock(
            return_value=httpx.Response(200, json={"claims": []})
        )
        respx.get(url__regex=r"https://en\.wikipedia\.org/.*").mock(
            return_value=httpx.Response(404)
        )
        respx.get("https://api.gdeltproject.org/api/v2/doc/doc").mock(
            return_value=httpx.Response(200, json={"articles": []})
        )
        # DDG returns one result
        respx.get("https://api.duckduckgo.com/").mock(
            return_value=httpx.Response(200, json={
                "AbstractURL": "https://reuters.com/article/test",
                "AbstractText": "Reuters reports on test claim.",
                "AbstractSource": "Reuters",
                "Heading": "Test claim",
                "RelatedTopics": [],
            })
        )

        bundle = await gather_evidence(
            query_text="obscure claim nobody fact-checked",
            entities=[],
            claim_texts=["obscure claim nobody fact-checked"],
            google_api_key="fake-fc-key",
            claimbuster_api_key=None,
            google_cse_api_key=None,   # no CSE key — should be skipped gracefully
            google_cse_id=None,
        )

        self.assertNotEqual(bundle.source_health.web_search, "skipped")
        self.assertGreater(len(bundle.web_results), 0)
        # DDG result should be tier A (reuters.com)
        self.assertEqual(bundle.web_results[0].tier, "A")
        self.assertEqual(bundle.web_results[0].source, "duckduckgo")


# ── 4. Missing GOOGLE_CSE_API_KEY does not crash the pipeline ─────────────────

class TestMissingCSEKeyNoCrash(unittest.IsolatedAsyncioTestCase):
    @respx.mock
    async def test_no_crash_without_cse_key(self):
        # Tier-1 all empty → fallback triggers; CSE key absent → only DDG runs
        respx.get("https://factchecktools.googleapis.com/v1alpha1/claims:search").mock(
            return_value=httpx.Response(200, json={"claims": []})
        )
        respx.get(url__regex=r"https://en\.wikipedia\.org/.*").mock(
            return_value=httpx.Response(404)
        )
        respx.get("https://api.gdeltproject.org/api/v2/doc/doc").mock(
            return_value=httpx.Response(200, json={"articles": []})
        )
        respx.get("https://api.duckduckgo.com/").mock(
            return_value=httpx.Response(200, json={
                "AbstractURL": "", "AbstractText": "", "Heading": "", "RelatedTopics": [],
            })
        )

        # Must not raise even with None CSE keys
        bundle = await gather_evidence(
            query_text="niche claim",
            entities=[],
            claim_texts=["niche claim"],
            google_api_key=None,
            claimbuster_api_key=None,
            google_cse_api_key=None,
            google_cse_id=None,
        )
        # Pipeline completed — bundle is a valid EvidenceBundle
        self.assertIsInstance(bundle, EvidenceBundle)
        # web_search status is either "empty" or "ok", never "skipped" (fallback did run)
        self.assertIn(bundle.source_health.web_search, {"ok", "empty"})


# ── 5. DuckDuckGo response parsing ───────────────────────────────────────────

class TestDuckDuckGoResponseParsing(unittest.IsolatedAsyncioTestCase):
    DDG_FIXTURE = {
        "AbstractURL": "https://apnews.com/article/elon-musk-twitter",
        "AbstractText": "AP News reports Elon Musk acquired Twitter for $44 billion.",
        "AbstractSource": "AP News",
        "Heading": "Elon Musk Twitter acquisition",
        "RelatedTopics": [
            {"FirstURL": "https://bbc.com/news/twitter-1", "Text": "BBC: Twitter rebranded to X."},
            {"FirstURL": "https://nytimes.com/twitter-2", "Text": "NYT: Musk fired 75% of Twitter staff."},
            # A sub-list topic (DDG sometimes nests these) — should be ignored
            [{"FirstURL": "https://irrelevant.com", "Text": "Noise"}],
        ],
    }

    @respx.mock
    async def test_abstract_parsed(self):
        respx.get("https://api.duckduckgo.com/").mock(
            return_value=httpx.Response(200, json=self.DDG_FIXTURE)
        )
        client = DuckDuckGoClient()
        results = await client.search_claim("Elon Musk acquired Twitter")

        self.assertGreater(len(results), 0)
        # First result is the abstract
        self.assertEqual(results[0].url, "https://apnews.com/article/elon-musk-twitter")
        self.assertEqual(results[0].source, "duckduckgo")
        self.assertEqual(results[0].tier, "A")   # apnews.com is Tier A

    @respx.mock
    async def test_related_topics_parsed(self):
        respx.get("https://api.duckduckgo.com/").mock(
            return_value=httpx.Response(200, json=self.DDG_FIXTURE)
        )
        client = DuckDuckGoClient()
        results = await client.search_claim("Elon Musk acquired Twitter")

        urls = [r.url for r in results]
        self.assertIn("https://bbc.com/news/twitter-1", urls)
        self.assertIn("https://nytimes.com/twitter-2", urls)
        # Nested list topic should NOT appear
        self.assertNotIn("https://irrelevant.com", urls)

    @respx.mock
    async def test_empty_response_returns_empty_list(self):
        respx.get("https://api.duckduckgo.com/").mock(
            return_value=httpx.Response(200, json={
                "AbstractURL": "", "AbstractText": "", "Heading": "", "RelatedTopics": [],
            })
        )
        client = DuckDuckGoClient()
        results = await client.search_claim("completely unknown claim")
        self.assertEqual(results, [])

    @respx.mock
    async def test_network_error_returns_empty_list(self):
        respx.get("https://api.duckduckgo.com/").mock(side_effect=httpx.ConnectError("timeout"))
        client = DuckDuckGoClient()
        results = await client.search_claim("any claim")
        self.assertEqual(results, [])


# ── 6. Tier computation ───────────────────────────────────────────────────────

class TestTierComputation(unittest.TestCase):
    def test_tier_a_domains(self):
        for domain in ["reuters.com", "apnews.com", "bbc.com", "who.int", "nih.gov"]:
            self.assertEqual(_compute_tier(domain), "A", domain)

    def test_tier_b_news_domains(self):
        self.assertEqual(_compute_tier("chicagotribune.com"), "B")
        self.assertEqual(_compute_tier("bostonherald.com"), "B")
        self.assertEqual(_compute_tier("dailymail.co.uk"), "B")

    def test_tier_c_everything_else(self):
        self.assertEqual(_compute_tier("randomsite.xyz"), "C")
        self.assertEqual(_compute_tier("myblog.com"), "C")


if __name__ == "__main__":
    unittest.main()
