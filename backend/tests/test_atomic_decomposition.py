"""Tests for Branch 1: SAFE-style atomic claim decomposition."""
from __future__ import annotations

import json
import sys
import types
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Minimal stubs so the module can be imported without the full FastAPI stack
# ---------------------------------------------------------------------------

# Stub anthropic so the import in extractor.py doesn't require the package
anthropic_stub = types.ModuleType("anthropic")
anthropic_stub.AsyncAnthropic = object  # type: ignore[attr-defined]
sys.modules.setdefault("anthropic", anthropic_stub)

# Now import the modules under test (uses the stubs above if real pkg absent)
from pipeline.extractor import (  # noqa: E402
    MAX_CLAIMS_PER_CHECK,
    _build_atomic_claim,
    _heuristic_extract,
    extract_claims,
)
from models.schemas import AtomicClaim, ClaimType, ExtractionResult  # noqa: E402


# ---------------------------------------------------------------------------
# Helper: build a fake Anthropic response object carrying text content
# ---------------------------------------------------------------------------

def _fake_message(text: str) -> MagicMock:
    block = MagicMock()
    block.type = "text"
    block.text = text
    msg = MagicMock()
    msg.content = [block]
    return msg


def _json_response(claims: list[dict]) -> MagicMock:
    return _fake_message(json.dumps(claims))


# ---------------------------------------------------------------------------
# 1. Multi-sentence paragraph → multiple atomic claims
# ---------------------------------------------------------------------------

class TestMultipleClaimsExtracted(unittest.IsolatedAsyncioTestCase):
    async def test_multi_sentence_produces_multiple_claims(self) -> None:
        text = (
            "[ORG:NASA] was founded in 1958. "
            "[PERSON:Neil Armstrong] walked on the [LOC:Moon] in 1969. "
            "[ORG:SpaceX] launched its first crewed mission in 2020."
        )
        raw = [
            {
                "id": 1,
                "claim": "[ORG:NASA] was founded in 1958.",
                "entities": [{"text": "NASA", "type": "ORG"}, {"text": "1958", "type": "DATE"}],
                "claim_type": "historical",
                "check_worthy": True,
                "reason_if_not": None,
            },
            {
                "id": 2,
                "claim": "[PERSON:Neil Armstrong] walked on the [LOC:Moon] in 1969.",
                "entities": [
                    {"text": "Neil Armstrong", "type": "PERSON"},
                    {"text": "Moon", "type": "LOC"},
                    {"text": "1969", "type": "DATE"},
                ],
                "claim_type": "historical",
                "check_worthy": True,
                "reason_if_not": None,
            },
            {
                "id": 3,
                "claim": "[ORG:SpaceX] launched its first crewed mission in 2020.",
                "entities": [{"text": "SpaceX", "type": "ORG"}, {"text": "2020", "type": "DATE"}],
                "claim_type": "historical",
                "check_worthy": True,
                "reason_if_not": None,
            },
        ]

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_json_response(raw))

        result = await extract_claims(mock_client, text)

        self.assertIsInstance(result, ExtractionResult)
        self.assertEqual(len(result.claims), 3)
        for claim in result.claims:
            self.assertIsInstance(claim, AtomicClaim)
            self.assertTrue(claim.check_worthy)


# ---------------------------------------------------------------------------
# 2. Pronoun replacement: Claude output should have explicit referents
# ---------------------------------------------------------------------------

class TestPronounReplacement(unittest.IsolatedAsyncioTestCase):
    async def test_pronoun_replaced_with_referent(self) -> None:
        # The article uses "he" — Claude should expand it to "Biden"
        article = (
            "[PERSON:Biden] announced a new climate policy. "
            "[PERSON:Biden] said the policy would cut emissions by 50%."
        )
        raw = [
            {
                "id": 1,
                "claim": "[PERSON:Biden] announced a new climate policy.",
                "entities": [{"text": "Biden", "type": "PERSON"}],
                "claim_type": "policy",
                "check_worthy": True,
                "reason_if_not": None,
            },
            {
                "id": 2,
                "claim": "[PERSON:Biden] said the policy would cut emissions by 50%.",
                "entities": [
                    {"text": "Biden", "type": "PERSON"},
                    {"text": "50%", "type": "QUANTITY"},
                ],
                "claim_type": "attributed_quote",
                "check_worthy": True,
                "reason_if_not": None,
            },
        ]

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_json_response(raw))

        result = await extract_claims(mock_client, article)

        for claim in result.claims:
            # Neither claim should contain bare pronouns
            lower = claim.text.lower()
            self.assertNotIn(" he ", lower)
            self.assertNotIn(" she ", lower)
            self.assertNotIn(" they ", lower)
            # Referent "Biden" must appear
            self.assertIn("Biden", claim.text)


# ---------------------------------------------------------------------------
# 3. Opinions should be excluded (check_worthy=False)
# ---------------------------------------------------------------------------

class TestOpinionsExcluded(unittest.IsolatedAsyncioTestCase):
    async def test_opinion_marked_not_check_worthy(self) -> None:
        raw = [
            {
                "id": 1,
                "claim": "I think the economy is improving.",
                "entities": [],
                "claim_type": "causal",
                "check_worthy": False,
                "reason_if_not": "opinion statement",
            },
            {
                "id": 2,
                "claim": "[ORG:Federal Reserve] raised interest rates by 0.25% in March 2024.",
                "entities": [
                    {"text": "Federal Reserve", "type": "ORG"},
                    {"text": "0.25%", "type": "QUANTITY"},
                    {"text": "March 2024", "type": "DATE"},
                ],
                "claim_type": "statistical",
                "check_worthy": True,
                "reason_if_not": None,
            },
        ]

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_json_response(raw))

        result = await extract_claims(mock_client, "dummy text")

        check_worthy_texts = [c.text for c in result.claims]
        skipped_texts = [c.text for c in result.skipped_claims]

        # Opinion ends up in skipped_claims, not claims
        self.assertFalse(any("I think" in t for t in check_worthy_texts))
        self.assertTrue(any("I think" in t for t in skipped_texts))

        # Factual claim is in check-worthy list
        self.assertTrue(any("Federal Reserve" in t for t in check_worthy_texts))

    async def test_opinion_check_worthy_false(self) -> None:
        raw = [
            {
                "id": 1,
                "claim": "Perhaps the government should act.",
                "entities": [],
                "claim_type": "policy",
                "check_worthy": False,
                "reason_if_not": "hedged opinion / prediction",
            },
        ]

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_json_response(raw))

        result = await extract_claims(mock_client, "dummy text")

        self.assertEqual(len(result.claims), 0)
        self.assertEqual(len(result.skipped_claims), 1)
        self.assertFalse(result.skipped_claims[0].check_worthy)


# ---------------------------------------------------------------------------
# 4. MAX_CLAIMS_PER_CHECK cap is respected
# ---------------------------------------------------------------------------

class TestMaxClaimsCap(unittest.IsolatedAsyncioTestCase):
    async def test_cap_at_max_claims(self) -> None:
        # Produce MAX_CLAIMS_PER_CHECK + 5 check-worthy claims
        total = MAX_CLAIMS_PER_CHECK + 5
        raw = [
            {
                "id": i + 1,
                "claim": f"Claim number {i + 1} is a verifiable fact.",
                "entities": [],
                "claim_type": "historical",
                "check_worthy": True,
                "reason_if_not": None,
            }
            for i in range(total)
        ]

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=_json_response(raw))

        result = await extract_claims(mock_client, "dummy text")

        self.assertLessEqual(len(result.claims), MAX_CLAIMS_PER_CHECK)
        self.assertEqual(len(result.claims), MAX_CLAIMS_PER_CHECK)

        # Overflow claims must be in skipped_claims
        self.assertEqual(len(result.skipped_claims), 5)

    async def test_cap_constant_is_10(self) -> None:
        self.assertEqual(MAX_CLAIMS_PER_CHECK, 10)


# ---------------------------------------------------------------------------
# 5. Heuristic fallback: works without Claude
# ---------------------------------------------------------------------------

class TestHeuristicFallback(unittest.IsolatedAsyncioTestCase):
    async def test_fallback_used_on_api_failure(self) -> None:
        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(side_effect=RuntimeError("API down"))

        text = (
            "The United Nations was founded in 1945 after World War II. "
            "NASA launched the Apollo 11 mission in 1969. "
            "Perhaps the situation will improve next year."
        )
        result = await extract_claims(mock_client, text)

        # Fallback should still produce an ExtractionResult
        self.assertIsInstance(result, ExtractionResult)
        # Opinions/predictions should be in skipped_claims
        skipped_texts = " ".join(c.text for c in result.skipped_claims).lower()
        self.assertIn("perhaps", skipped_texts)

    def test_heuristic_extract_direct(self) -> None:
        text = (
            "Joe Biden signed the Inflation Reduction Act in 2022. "
            "I think this was a great decision. "
            "The bill allocated $369 billion for climate programs."
        )
        result = _heuristic_extract(text)

        self.assertIsInstance(result, ExtractionResult)
        # Opinion sentence should be in skipped
        skipped_lower = " ".join(c.text for c in result.skipped_claims).lower()
        self.assertIn("i think", skipped_lower)

    def test_heuristic_respects_max_cap(self) -> None:
        sentences = [f"Company{i} reported revenue of ${i} billion in 2023." for i in range(20)]
        text = " ".join(sentences)
        result = _heuristic_extract(text)
        self.assertLessEqual(len(result.claims), MAX_CLAIMS_PER_CHECK)


# ---------------------------------------------------------------------------
# 6. _build_atomic_claim unit tests
# ---------------------------------------------------------------------------

class TestBuildAtomicClaim(unittest.TestCase):
    def test_valid_raw(self) -> None:
        raw = {
            "id": 3,
            "claim": "[PERSON:Elon Musk] founded [ORG:SpaceX] in 2002.",
            "entities": [
                {"text": "Elon Musk", "type": "PERSON"},
                {"text": "SpaceX", "type": "ORG"},
                {"text": "2002", "type": "DATE"},
            ],
            "claim_type": "biographical",
            "check_worthy": True,
            "reason_if_not": None,
        }
        claim = _build_atomic_claim(raw, 1)
        self.assertEqual(claim.id, "claim_3")
        self.assertEqual(claim.claim_type, ClaimType.BIOGRAPHICAL)
        self.assertEqual(claim.entity, "Elon Musk")  # first PERSON entity
        self.assertTrue(claim.check_worthy)

    def test_unknown_claim_type_defaults_to_historical(self) -> None:
        raw = {
            "id": 1,
            "claim": "Some fact.",
            "entities": [],
            "claim_type": "totally_unknown_type",
            "check_worthy": True,
            "reason_if_not": None,
        }
        claim = _build_atomic_claim(raw, 1)
        self.assertEqual(claim.claim_type, ClaimType.HISTORICAL)

    def test_missing_entities_produces_empty_list(self) -> None:
        raw = {
            "id": 1,
            "claim": "Something happened.",
            "claim_type": "historical",
            "check_worthy": True,
            "reason_if_not": None,
        }
        claim = _build_atomic_claim(raw, 1)
        self.assertEqual(claim.entities, [])
        self.assertIsNone(claim.entity)


if __name__ == "__main__":
    unittest.main()
