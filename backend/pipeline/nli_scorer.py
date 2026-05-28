from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from models.schemas import NLIScore, VerdictBand

logger = logging.getLogger("sachcheck.nli")

_NLI_MODEL = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"

_nli_pipe: Any = None
_nli_lock = asyncio.Lock()

_NEUTRAL_SCORE = NLIScore(
    entailment=0.0,
    contradiction=0.0,
    neutral=1.0,
    stance="neutral",
    confidence=0.0,
)


def _load_model() -> Any:
    from transformers import pipeline as hf_pipeline  # lazy import — heavy dep

    device = int(os.getenv("NLI_DEVICE", "-1"))
    return hf_pipeline(
        "text-classification",
        model=_NLI_MODEL,
        device=device,
        top_k=None,  # return all 3 label scores
    )


async def get_nli_pipeline() -> Any:
    global _nli_pipe
    async with _nli_lock:
        if _nli_pipe is None:
            loop = asyncio.get_event_loop()
            _nli_pipe = await loop.run_in_executor(None, _load_model)
    return _nli_pipe


def _parse_scores(raw: list[dict]) -> NLIScore:
    """Convert HuggingFace label-score list to NLIScore."""
    scores: dict[str, float] = {}
    for item in raw:
        label = item.get("label", "").lower()
        score = float(item.get("score", 0.0))
        if "entail" in label:
            scores["entailment"] = score
        elif "contradict" in label:
            scores["contradiction"] = score
        else:
            scores["neutral"] = score

    entailment = scores.get("entailment", 0.0)
    contradiction = scores.get("contradiction", 0.0)
    neutral = scores.get("neutral", 1.0 - entailment - contradiction)

    if entailment > 0.6:
        stance = "supports"
    elif contradiction > 0.6:
        stance = "contradicts"
    else:
        stance = "neutral"

    return NLIScore(
        entailment=entailment,
        contradiction=contradiction,
        neutral=max(0.0, neutral),
        stance=stance,
        confidence=max(entailment, contradiction),
    )


def _run_nli_batch(pipe: Any, premise_hypothesis_pairs: list[tuple[str, str]]) -> list[NLIScore]:
    """Synchronous batch call — runs in executor."""
    results: list[NLIScore] = []
    for premise, hypothesis in premise_hypothesis_pairs:
        try:
            raw = pipe({"text": premise, "text_pair": hypothesis})
            # top_k=None returns a list directly
            if isinstance(raw, list) and raw and isinstance(raw[0], dict):
                results.append(_parse_scores(raw))
            elif isinstance(raw, list) and raw and isinstance(raw[0], list):
                results.append(_parse_scores(raw[0]))
            else:
                results.append(_NEUTRAL_SCORE)
        except Exception as exc:
            logger.debug("NLI scoring failed for one passage: %s", exc)
            results.append(_NEUTRAL_SCORE)
    return results


async def score_passage_against_claim(
    claim: str,
    passage: str,
    max_passage_chars: int = 512,
) -> NLIScore:
    """Score a single passage as supporting/contradicting/neutral toward the claim."""
    if os.getenv("NLI_ENABLED", "true").lower() in ("false", "0", "no"):
        return _NEUTRAL_SCORE
    try:
        pipe = await get_nli_pipeline()
        truncated = passage[:max_passage_chars]
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, _run_nli_batch, pipe, [(truncated, claim)])
        return results[0]
    except Exception as exc:
        logger.warning("NLI pipeline unavailable: %s", exc)
        return _NEUTRAL_SCORE


async def batch_score_passages(
    claim: str,
    passages: list[str],
    max_passage_chars: int = 512,
) -> list[NLIScore]:
    """Score all passages against a claim in a single executor call."""
    if not passages:
        return []
    if os.getenv("NLI_ENABLED", "true").lower() in ("false", "0", "no"):
        return [_NEUTRAL_SCORE] * len(passages)
    try:
        pipe = await get_nli_pipeline()
        pairs = [(p[:max_passage_chars], claim) for p in passages]
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _run_nli_batch, pipe, pairs)
    except Exception as exc:
        logger.warning("NLI batch scoring failed: %s", exc)
        return [_NEUTRAL_SCORE] * len(passages)


def compute_verdict_band(
    max_support: float,
    max_refute: float,
    n_supporting: int,
    n_contradicting: int,
    tier1_all_empty: bool,
) -> VerdictBand:
    if tier1_all_empty:
        return VerdictBand.INSUFFICIENT_EVIDENCE
    if max_support > 0.7 and max_refute < 0.2:
        return VerdictBand.SUPPORTED
    elif max_refute > 0.7 and max_support < 0.2:
        return VerdictBand.REFUTED
    elif max_support > 0.4 and max_refute > 0.4:
        return VerdictBand.MIXED
    else:
        return VerdictBand.INSUFFICIENT_EVIDENCE
