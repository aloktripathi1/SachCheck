"""Tests for Branch 3: NLI contradiction detection."""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from models.schemas import NLIScore, VerdictBand
from pipeline.nli_scorer import (
    _parse_scores,
    _run_nli_batch,
    batch_score_passages,
    compute_verdict_band,
    score_passage_against_claim,
)


# ── HuggingFace pipeline mock helpers ─────────────────────────────────────────

def _mock_pipe(entailment: float, contradiction: float) -> MagicMock:
    """Return a callable mock that always produces the given scores."""
    neutral = max(0.0, 1.0 - entailment - contradiction)
    pipe = MagicMock()
    pipe.return_value = [
        {"label": "entailment", "score": entailment},
        {"label": "contradiction", "score": contradiction},
        {"label": "neutral", "score": neutral},
    ]
    return pipe


# ── 1. Supporting passage → stance == "supports" ──────────────────────────────

class TestSupportingPassage(unittest.IsolatedAsyncioTestCase):
    async def test_clearly_supporting(self):
        pipe = _mock_pipe(entailment=0.92, contradiction=0.03)
        with patch("pipeline.nli_scorer.get_nli_pipeline", return_value=pipe):
            # Patch get_nli_pipeline to return the mock directly (it's awaited)
            async def mock_get():
                return pipe
            with patch("pipeline.nli_scorer.get_nli_pipeline", mock_get):
                result = await score_passage_against_claim(
                    claim="The Eiffel Tower is located in Paris.",
                    passage="The Eiffel Tower stands in Paris, France, and was completed in 1889.",
                )
        self.assertEqual(result.stance, "supports")
        self.assertGreater(result.entailment, 0.6)
        self.assertGreater(result.confidence, 0.6)


# ── 2. Contradicting passage → stance == "contradicts" ───────────────────────

class TestContradictingPassage(unittest.IsolatedAsyncioTestCase):
    async def test_clearly_contradicting(self):
        pipe = _mock_pipe(entailment=0.04, contradiction=0.91)
        async def mock_get():
            return pipe
        with patch("pipeline.nli_scorer.get_nli_pipeline", mock_get):
            result = await score_passage_against_claim(
                claim="The Earth is flat.",
                passage="Scientific consensus and centuries of evidence confirm the Earth is an oblate spheroid.",
            )
        self.assertEqual(result.stance, "contradicts")
        self.assertGreater(result.contradiction, 0.6)


# ── 3. Unrelated passage → stance == "neutral" ───────────────────────────────

class TestNeutralPassage(unittest.IsolatedAsyncioTestCase):
    async def test_unrelated_passage(self):
        pipe = _mock_pipe(entailment=0.15, contradiction=0.10)
        async def mock_get():
            return pipe
        with patch("pipeline.nli_scorer.get_nli_pipeline", mock_get):
            result = await score_passage_against_claim(
                claim="Apple reported $383 billion revenue in 2023.",
                passage="The Amazon rainforest covers approximately 5.5 million km².",
            )
        self.assertEqual(result.stance, "neutral")


# ── 4. compute_verdict_band for all 4 bands ───────────────────────────────────

class TestComputeVerdictBand(unittest.TestCase):
    def test_supported(self):
        band = compute_verdict_band(
            max_support=0.85, max_refute=0.05,
            n_supporting=3, n_contradicting=0,
            tier1_all_empty=False,
        )
        self.assertEqual(band, VerdictBand.SUPPORTED)

    def test_refuted(self):
        band = compute_verdict_band(
            max_support=0.05, max_refute=0.88,
            n_supporting=0, n_contradicting=2,
            tier1_all_empty=False,
        )
        self.assertEqual(band, VerdictBand.REFUTED)

    def test_mixed(self):
        band = compute_verdict_band(
            max_support=0.65, max_refute=0.62,
            n_supporting=2, n_contradicting=2,
            tier1_all_empty=False,
        )
        self.assertEqual(band, VerdictBand.MIXED)

    def test_insufficient_evidence_low_scores(self):
        band = compute_verdict_band(
            max_support=0.20, max_refute=0.18,
            n_supporting=0, n_contradicting=0,
            tier1_all_empty=False,
        )
        self.assertEqual(band, VerdictBand.INSUFFICIENT_EVIDENCE)

    def test_insufficient_evidence_tier1_empty(self):
        # Even strong NLI scores → INSUFFICIENT when all Tier-1 sources are empty
        band = compute_verdict_band(
            max_support=0.90, max_refute=0.02,
            n_supporting=3, n_contradicting=0,
            tier1_all_empty=True,
        )
        self.assertEqual(band, VerdictBand.INSUFFICIENT_EVIDENCE)

    def test_boundary_support_exactly_07(self):
        # max_support == 0.7 is NOT > 0.7, so should not be SUPPORTED
        band = compute_verdict_band(
            max_support=0.70, max_refute=0.10,
            n_supporting=2, n_contradicting=0,
            tier1_all_empty=False,
        )
        self.assertNotEqual(band, VerdictBand.SUPPORTED)

    def test_boundary_refute_exactly_07(self):
        band = compute_verdict_band(
            max_support=0.10, max_refute=0.70,
            n_supporting=0, n_contradicting=2,
            tier1_all_empty=False,
        )
        self.assertNotEqual(band, VerdictBand.REFUTED)


# ── 5. NLI failure returns neutral score without raising ─────────────────────

class TestNLIFailureSafe(unittest.IsolatedAsyncioTestCase):
    async def test_pipeline_exception_returns_neutral(self):
        async def mock_get():
            raise RuntimeError("model load failed")
        with patch("pipeline.nli_scorer.get_nli_pipeline", mock_get):
            result = await score_passage_against_claim(
                claim="Some claim.", passage="Some passage."
            )
        self.assertIsInstance(result, NLIScore)
        self.assertEqual(result.stance, "neutral")
        self.assertEqual(result.confidence, 0.0)

    async def test_batch_exception_returns_neutral_list(self):
        async def mock_get():
            raise RuntimeError("model load failed")
        with patch("pipeline.nli_scorer.get_nli_pipeline", mock_get):
            results = await batch_score_passages(
                claim="Some claim.",
                passages=["passage one", "passage two", "passage three"],
            )
        self.assertEqual(len(results), 3)
        for r in results:
            self.assertEqual(r.stance, "neutral")

    async def test_empty_passages_returns_empty_list(self):
        results = await batch_score_passages(claim="Any claim.", passages=[])
        self.assertEqual(results, [])


# ── 6. _parse_scores unit tests ───────────────────────────────────────────────

class TestParseScores(unittest.TestCase):
    def test_high_entailment(self):
        raw = [
            {"label": "entailment", "score": 0.88},
            {"label": "contradiction", "score": 0.07},
            {"label": "neutral", "score": 0.05},
        ]
        result = _parse_scores(raw)
        self.assertEqual(result.stance, "supports")
        self.assertAlmostEqual(result.entailment, 0.88)
        self.assertAlmostEqual(result.confidence, 0.88)

    def test_high_contradiction(self):
        raw = [
            {"label": "entailment", "score": 0.05},
            {"label": "contradiction", "score": 0.89},
            {"label": "neutral", "score": 0.06},
        ]
        result = _parse_scores(raw)
        self.assertEqual(result.stance, "contradicts")
        self.assertAlmostEqual(result.confidence, 0.89)

    def test_neutral_label_case_variants(self):
        # Some HuggingFace models return "NEUTRAL" or "neutral" — both should work
        raw = [
            {"label": "ENTAILMENT", "score": 0.30},
            {"label": "CONTRADICTION", "score": 0.25},
            {"label": "NEUTRAL", "score": 0.45},
        ]
        result = _parse_scores(raw)
        self.assertEqual(result.stance, "neutral")

    def test_confidence_is_max_of_entailment_contradiction(self):
        raw = [
            {"label": "entailment", "score": 0.55},
            {"label": "contradiction", "score": 0.30},
            {"label": "neutral", "score": 0.15},
        ]
        result = _parse_scores(raw)
        self.assertAlmostEqual(result.confidence, 0.55)


# ── 7. NLI disabled via env var ───────────────────────────────────────────────

class TestNLIDisabled(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_returns_neutral_without_loading_model(self):
        load_called = []
        async def mock_get():
            load_called.append(True)
            return MagicMock()

        with patch.dict("os.environ", {"NLI_ENABLED": "false"}):
            with patch("pipeline.nli_scorer.get_nli_pipeline", mock_get):
                result = await score_passage_against_claim("claim", "passage")

        self.assertEqual(result.stance, "neutral")
        self.assertEqual(load_called, [], "get_nli_pipeline should not be called when NLI_ENABLED=false")

    async def test_batch_disabled_returns_neutral_list(self):
        with patch.dict("os.environ", {"NLI_ENABLED": "0"}):
            results = await batch_score_passages("claim", ["p1", "p2"])
        self.assertEqual(len(results), 2)
        for r in results:
            self.assertEqual(r.stance, "neutral")


if __name__ == "__main__":
    unittest.main()
