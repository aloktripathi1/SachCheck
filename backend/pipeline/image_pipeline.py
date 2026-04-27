"""
Full image fact-check pipeline.
Step 1: Preprocess  →  Step 2: OCR  →  Step 3: Extract claims
Step 4: Gather evidence  →  Step 5: Manipulation signals
Step 6: Synthesize verdict  →  Stream SSE events
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from uuid import UUID

from anthropic import AsyncAnthropic

from models.image_schemas import ImageStreamEventType
from pipeline.evidence import gather_evidence
from pipeline.extractor import extract_claims
from pipeline.image_ocr import run_ocr
from pipeline.image_preprocessing import preprocess
from pipeline.image_signals import compute_signal_score, detect_signals
from pipeline.scorer import score_article

logger = logging.getLogger("sachcheck.image")


# ── Synthesis prompt ──────────────────────────────────────────────────────────

IMAGE_SYNTHESIS_PROMPT = """\
You are a misinformation analyst reviewing a viral image or screenshot.

You will receive:
- extracted_text: OCR text from the image
- claims: atomic factual claims extracted from the text
- evidence: fact-check evidence from Wikipedia, Google Fact Check, GDELT
- manipulation_signals: red-flag heuristic signals fired on the text
- signal_score: 0-100 suspicion score (higher = more suspicious)

Your task:
1. Assess whether the claims in the image are TRUE, MISLEADING, LIKELY FALSE, or UNVERIFIABLE.
2. Write a 2-3 sentence plain-language reasoning.
3. Write a 1 sentence "safer_context" the reader can use to verify themselves.
4. Return a JSON object with these exact keys:
   - verdict_label: one of "Likely Authentic" | "Potentially Misleading" | "Likely False" | "Unverifiable" | "Satire Risk"
   - overall_score: integer 0-100 (0 = completely false, 100 = fully credible)
   - confidence: float 0.0-1.0
   - reasoning: string
   - safer_context: string

Rules:
- If signal_score > 60 AND evidence is weak → verdict "Likely False", score < 30.
- If no claims and no evidence → "Unverifiable".
- Never invent source URLs.
- Be calibrated: say "Unverifiable" when evidence is truly absent.
"""


async def _synthesize_image_verdict(
    client: AsyncAnthropic,
    extracted_text: str,
    claims: list[dict],
    evidence: dict,
    signal_score: int,
    signals: list[dict],
    heuristic_score: int,
    model: str,
) -> dict:
    payload = {
        "extracted_text": extracted_text[:2000],
        "claims": claims[:8],
        "evidence": {
            "google_fact_check_reviews": evidence.get("google_fact_check_reviews", []),
            "wikipedia_summaries": evidence.get("wikipedia_summaries", []),
            "gdelt_volume": evidence.get("gdelt_volume", 0),
        },
        "manipulation_signals": [s for s in signals if s.get("fired")],
        "signal_score": signal_score,
        "heuristic_score": heuristic_score,
    }

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=800,
            temperature=0.1,
            system=[{"type": "text", "text": IMAGE_SYNTHESIS_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": f"Analyse this image content:\n\n{json.dumps(payload)}"}],
        )
        text = "".join(b.text for b in response.content if getattr(b, "type", "") == "text").strip()
        if text.startswith("```"):
            text = text.strip("`").replace("json", "", 1).strip()
        return json.loads(text)
    except Exception as exc:
        logger.warning("Image synthesis failed: %s", exc)
        return _fallback_verdict(signal_score, bool(claims))


def _fallback_verdict(signal_score: int, has_claims: bool) -> dict:
    if not has_claims:
        return {
            "verdict_label": "Unverifiable",
            "overall_score": 40,
            "confidence": 0.35,
            "reasoning": "Not enough text was extracted to verify any specific claims.",
            "safer_context": "Search for the main topic on a trusted news site before sharing.",
        }
    if signal_score > 60:
        return {
            "verdict_label": "Potentially Misleading",
            "overall_score": 28,
            "confidence": 0.62,
            "reasoning": "Multiple manipulation signals were detected including urgency language and no source attribution.",
            "safer_context": "Verify with a trusted outlet before sharing — this content shows hallmarks of misinformation.",
        }
    return {
        "verdict_label": "Unverifiable",
        "overall_score": 50,
        "confidence": 0.4,
        "reasoning": "Limited evidence found to confirm or deny the claims in this image.",
        "safer_context": "Cross-reference with a primary source before drawing conclusions.",
    }


def _band_from_score(score: int) -> str:
    if score >= 70:
        return "green"
    if score >= 40:
        return "yellow"
    return "red"


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_image_pipeline(
    check_id: UUID,
    image_bytes: bytes,
    publish,          # async callable(check_id, event_type, data)
    client: AsyncAnthropic,
) -> None:
    extract_model  = os.getenv("ANTHROPIC_EXTRACT_MODEL", "claude-haiku-4-5-20251001")
    synthesis_model = os.getenv("ANTHROPIC_SYNTHESIS_MODEL", "claude-sonnet-4-6")

    try:
        # ── Step 1: Preprocess ──────────────────────────────────────────────
        await publish(check_id, ImageStreamEventType.PREPROCESSING, {"message": "Preprocessing image…"})
        _, ocr_img = preprocess(image_bytes)

        # ── Step 2: OCR ─────────────────────────────────────────────────────
        await publish(check_id, ImageStreamEventType.OCR_RUNNING, {"message": "Extracting text from image…"})
        ocr = await run_ocr(client, ocr_img)

        await publish(check_id, ImageStreamEventType.OCR_COMPLETE, {
            "ocr": ocr.to_dict(),
            "message": f"Extracted {ocr.word_count} words via {ocr.method}",
        })

        # ── Step 3: Claim extraction ────────────────────────────────────────
        await publish(check_id, ImageStreamEventType.EXTRACTING, {"message": "Extracting factual claims…"})
        extraction = await extract_claims(client, ocr.text, model=extract_model) if ocr.text else None
        claims_list = [c.model_dump() for c in extraction.claims] if extraction else []
        entities    = extraction.entities if extraction else []

        for claim_dict in claims_list:
            await publish(check_id, ImageStreamEventType.CLAIM_FOUND, {"claim": claim_dict})

        # ── Step 4: Evidence gathering ──────────────────────────────────────
        await publish(check_id, ImageStreamEventType.GATHERING, {
            "message": "Cross-checking with Google Fact Check, Wikipedia, GDELT…",
        })
        evidence_bundle = None
        evidence_summary: dict = {"google_fact_check_reviews": [], "wikipedia_summaries": [], "gdelt_volume": 0}
        heuristic_score = 50

        if ocr.text and len(ocr.text) > 30:
            try:
                evidence_bundle = await gather_evidence(
                    query_text=ocr.text[:500],
                    entities=entities[:5],
                    claim_texts=[c["text"] for c in claims_list[:4]],
                    google_api_key=os.getenv("GOOGLE_FC_API_KEY"),
                    claimbuster_api_key=os.getenv("CLAIMBUSTER_API_KEY"),
                )
                evidence_summary = {
                    "google_fact_check_reviews": [
                        {"claim": r.claim_text, "verdict": r.verdict, "publisher": r.publisher}
                        for r in evidence_bundle.google_fact_check.reviews[:4]
                    ],
                    "wikipedia_summaries": [
                        {"entity": w.entity, "title": w.title}
                        for w in evidence_bundle.wikipedia[:3]
                    ],
                    "gdelt_volume": evidence_bundle.gdelt.volume,
                }
                hs = await score_article(
                    source_url=None,
                    title=None,
                    article_text=ocr.text,
                    author_byline_present=False,
                    evidence=evidence_bundle,
                )
                heuristic_score = hs.final_score
            except Exception as exc:
                logger.warning("Evidence gathering failed: %s", exc)

        await publish(check_id, ImageStreamEventType.EVIDENCE_READY, {
            "evidence_summary": evidence_summary,
            "message": "Evidence gathered",
        })

        # ── Step 5: Manipulation signals ────────────────────────────────────
        await publish(check_id, ImageStreamEventType.SIGNALS, {"message": "Analysing manipulation signals…"})
        signals = detect_signals(ocr.text)
        signal_score = compute_signal_score(signals)
        signals_dicts = [s.to_dict() for s in signals]

        await publish(check_id, ImageStreamEventType.SIGNALS_READY, {
            "signals": signals_dicts,
            "signal_score": signal_score,
        })

        # ── Step 6: Verdict synthesis ────────────────────────────────────────
        await publish(check_id, ImageStreamEventType.SYNTHESIZING, {"message": "Synthesising final verdict…"})
        verdict_data = await _synthesize_image_verdict(
            client=client,
            extracted_text=ocr.text,
            claims=claims_list,
            evidence=evidence_summary,
            signal_score=signal_score,
            signals=signals_dicts,
            heuristic_score=heuristic_score,
            model=synthesis_model,
        )

        overall_score = int(verdict_data.get("overall_score", 50))
        await publish(check_id, ImageStreamEventType.VERDICT, {
            "verdict": {
                **verdict_data,
                "overall_score": overall_score,
                "band": _band_from_score(overall_score),
                "extracted_text": ocr.text,
                "ocr_confidence": ocr.confidence,
                "ocr_language": ocr.language,
                "ocr_method": ocr.method,
                "extracted_claims": claims_list,
                "manipulation_signals": signals_dicts,
                "signal_score": signal_score,
                "evidence_summary": evidence_summary,
            }
        })

    except Exception:
        logger.exception("Image pipeline failed for check_id=%s", check_id)
        await publish(check_id, ImageStreamEventType.ERROR, {
            "message": "SachCheck could not complete the image analysis. Please try again."
        })
    finally:
        await publish(check_id, ImageStreamEventType.DONE, {"status": "complete"})
