from __future__ import annotations

import json
import logging
from typing import Any

from anthropic import AsyncAnthropic

from models.schemas import (
    ArticleBand,
    ArticleVerdict,
    AtomicClaim,
    Claim,
    ClaimVerdict,
    ClaimVerdictLabel,
    EvidenceBundle,
    HeuristicScore,
    NLIScore,
    SourceRef,
    VerdictBand,
)
from pipeline.nli_scorer import batch_score_passages, compute_verdict_band

logger = logging.getLogger("sachcheck.synthesizer")


SYNTHESIS_TOOL_NAME = "return_article_verdict"

SYNTHESIS_SYSTEM_PROMPT = (
    "You are a fact-verification synthesizer. You receive extracted claims, "
    "evidence from 4 sources, and heuristic signals. For each claim, "
    "produce a verdict from: true | mostly_true | mixed | mostly_false | "
    "false | unverified. Include a 0-1 confidence score and a one-sentence "
    "plain-language explanation. Only cite sources present in the provided "
    "evidence; never invent citations. For the article-level score, "
    "use NewsGuard-style bands: 75+ green, 40-74 yellow, below 40 red. "
    "If fewer than 2 independent signals are available, return band: "
    "'insufficient'. Show every heuristic signal that contributed to "
    "the score. Be calibrated: hedge when evidence is sparse."
)

NLI_SYNTHESIS_SYSTEM_PROMPT = (
    "You are a fact-checking analyst. Evidence passages have been pre-scored "
    "by an NLI model (DeBERTa) and sorted by stance toward each claim. "
    "Base your verdict ONLY on the evidence provided. "
    "Every factual sentence in your reasoning must end with [S#] citing a "
    "numbered passage. If no passage supports an assertion, write "
    "'(not in sources)' — do NOT invent support. "
    "Your verdict_label choices: true | mostly_true | mixed | mostly_false | false | unverified. "
    "For the article-level score use NewsGuard-style bands: 75+ green, 40-74 yellow, below 40 red. "
    "Be calibrated: hedge when evidence is sparse."
)


def _band_from_score(score: int, independent_signals: int) -> ArticleBand:
    if independent_signals < 2:
        return ArticleBand.INSUFFICIENT
    if score >= 75:
        return ArticleBand.GREEN
    if score >= 40:
        return ArticleBand.YELLOW
    return ArticleBand.RED


def _default_confidence_band(score: int, independent_signals: int) -> str:
    medium = "Medium" if independent_signals >= 3 else "Low"
    return f"{max(1, min(10, round(score / 10)))}/10 +/- 2, {medium} confidence"


def _claim_sources(evidence: EvidenceBundle, limit: int = 4) -> list[SourceRef]:
    refs: list[SourceRef] = []

    for review in evidence.google_fact_check.reviews:
        refs.append(SourceRef(publisher=review.publisher, url=review.url, title=review.claim_text))

    for article in evidence.gdelt.articles:
        refs.append(SourceRef(publisher="GDELT", url=article.url, title=article.title))

    for summary in evidence.wikipedia:
        if summary.url:
            refs.append(SourceRef(publisher="Wikipedia", url=summary.url, title=summary.title))

    dedup: list[SourceRef] = []
    seen: set[str] = set()
    for ref in refs:
        key = str(ref.url)
        if key in seen:
            continue
        seen.add(key)
        dedup.append(ref)
        if len(dedup) >= limit:
            break

    return dedup


def _fallback_claim_verdict(claim: Claim | AtomicClaim, evidence: EvidenceBundle) -> ClaimVerdict:
    false_hits = 0
    true_hits = 0
    matched_sources: list[SourceRef] = []

    for review in evidence.google_fact_check.reviews:
        if claim.text.lower()[:45] in review.claim_text.lower() or review.claim_text.lower()[:45] in claim.text.lower():
            verdict_text = review.verdict.lower()
            if "false" in verdict_text:
                false_hits += 1
            if "true" in verdict_text:
                true_hits += 1
            matched_sources.append(SourceRef(publisher=review.publisher, url=review.url, title=review.claim_text))

    if false_hits > true_hits and false_hits > 0:
        label = ClaimVerdictLabel.FALSE
        confidence = 0.78
        explanation = "Independent fact-check entries in the evidence align with a false assessment."
    elif true_hits > false_hits and true_hits > 0:
        label = ClaimVerdictLabel.MOSTLY_TRUE
        confidence = 0.72
        explanation = "Available fact-check evidence trends toward this claim being true with some caveats."
    elif evidence.gdelt.volume == 0 and not evidence.wikipedia:
        label = ClaimVerdictLabel.UNVERIFIED
        confidence = 0.35
        explanation = "Evidence coverage is sparse, so this claim cannot be verified confidently."
    else:
        label = ClaimVerdictLabel.MIXED
        confidence = 0.55
        explanation = "Signals are mixed across sources, with no strong consensus either way."

    if not matched_sources:
        matched_sources = _claim_sources(evidence)

    return ClaimVerdict(
        claim_id=claim.id,
        verdict=label,
        confidence=confidence,
        explanation=explanation,
        sources=matched_sources,
    )


def _fallback_article_verdict(claims: list[Claim | AtomicClaim], evidence: EvidenceBundle, score: HeuristicScore) -> ArticleVerdict:
    claim_verdicts = [_fallback_claim_verdict(claim, evidence) for claim in claims]
    band = _band_from_score(score.final_score, score.independent_signal_count)

    return ArticleVerdict(
        score=score.final_score,
        band=band,
        confidence_band=_default_confidence_band(score.final_score, score.independent_signal_count),
        signals_fired=score.signals_fired,
        claim_verdicts=claim_verdicts,
    )


def _extract_passages(evidence: EvidenceBundle) -> list[tuple[str, str]]:
    """Return (passage_text, source_label) pairs from all evidence sources."""
    passages: list[tuple[str, str]] = []
    for review in evidence.google_fact_check.reviews:
        passages.append((f"{review.claim_text} — {review.verdict}", f"Google FC / {review.publisher}"))
    for summary in evidence.wikipedia:
        if summary.summary:
            passages.append((summary.summary[:600], f"Wikipedia: {summary.title}"))
    for article in evidence.gdelt.articles[:5]:
        passages.append((article.title, f"GDELT: {article.source_country or 'unknown'}"))
    for result in evidence.web_results:
        if result.description:
            passages.append((result.description[:400], f"Web ({result.tier}): {result.domain}"))
    return passages


def _build_nli_prompt(
    claim: AtomicClaim,
    passages: list[tuple[str, str]],
    nli_scores: list[NLIScore],
    verdict_band: VerdictBand,
) -> str:
    """Build a stance-sorted numbered evidence prompt for Sonnet."""
    tagged = list(zip(passages, nli_scores))

    supporting    = sorted([(p, s) for p, s in tagged if s.stance == "supports"],    key=lambda x: x[1].confidence, reverse=True)[:3]
    contradicting = sorted([(p, s) for p, s in tagged if s.stance == "contradicts"], key=lambda x: x[1].confidence, reverse=True)[:3]
    neutral_list  = sorted([(p, s) for p, s in tagged if s.stance == "neutral"],     key=lambda x: x[1].confidence, reverse=True)[:3]

    # Build global numbered passage index for [S#] citations
    ordered = supporting + contradicting + neutral_list
    lines: list[str] = []
    idx = 1
    support_block:   list[str] = []
    refute_block:    list[str] = []
    neutral_block:   list[str] = []

    for (text, label), score in supporting:
        support_block.append(f"  [S{idx}] ({label}, confidence={score.confidence:.2f}) {text}")
        idx += 1
    for (text, label), score in contradicting:
        refute_block.append(f"  [S{idx}] ({label}, confidence={score.confidence:.2f}) {text}")
        idx += 1
    for (text, label), score in neutral_list:
        neutral_block.append(f"  [S{idx}] ({label}) {text}")
        idx += 1

    claim_text = claim.text
    prompt = (
        f"NLI pre-computed verdict band: {verdict_band.value}\n\n"
        f"Claim: {claim_text}\n\n"
        f"Evidence SUPPORTING this claim ({len(support_block)} passages):\n"
        + ("\n".join(support_block) if support_block else "  (none)\n")
        + f"\n\nEvidence CONTRADICTING this claim ({len(refute_block)} passages):\n"
        + ("\n".join(refute_block) if refute_block else "  (none)\n")
        + f"\n\nNeutral/contextual evidence ({len(neutral_block)} passages):\n"
        + ("\n".join(neutral_block) if neutral_block else "  (none)\n")
    )
    return prompt


def _parse_json(text: str) -> dict[str, Any]:
    clean = text.strip()
    if clean.startswith("```"):
        clean = clean.strip("`")
        clean = clean.replace("json", "", 1).strip()
    return json.loads(clean)


def _extract_tool_input(message: Any, tool_name: str) -> dict[str, Any] | None:
    for block in message.content:
        if getattr(block, "type", "") == "tool_use" and getattr(block, "name", "") == tool_name:
            tool_input = getattr(block, "input", None)
            if isinstance(tool_input, dict):
                return tool_input
    return None


def _analysis_markdown(verdict: ArticleVerdict) -> str:
    return (
        f"## SachCheck analysis\n\n"
        f"Score: **{verdict.score}/100** ({verdict.band.value}).\n\n"
        f"Signals fired: {', '.join(verdict.signals_fired) if verdict.signals_fired else 'none'}.\n\n"
        "This is an automated heuristic credibility estimate. It is not a determination of truth. "
        "Always consult primary sources and the cited fact-checks below."
    )


def _nli_enriched_verdict(
    cv: ClaimVerdict,
    nli_scores: list[NLIScore],
    verdict_band: VerdictBand,
) -> ClaimVerdict:
    """Attach NLI aggregate stats to an existing ClaimVerdict."""
    if not nli_scores:
        return cv
    max_support = max((s.entailment for s in nli_scores), default=0.0)
    max_refute  = max((s.contradiction for s in nli_scores), default=0.0)
    n_supporting    = sum(1 for s in nli_scores if s.stance == "supports")
    n_contradicting = sum(1 for s in nli_scores if s.stance == "contradicts")
    cv.nli_support_score  = round(max_support, 4)
    cv.nli_refute_score   = round(max_refute, 4)
    cv.verdict_band       = verdict_band
    cv.supporting_count   = n_supporting
    cv.contradicting_count = n_contradicting
    return cv


async def synthesize(
    client: AsyncAnthropic,
    claims: list[AtomicClaim],
    evidence: EvidenceBundle,
    score: HeuristicScore,
    model: str = "claude-sonnet-4-6",
    nli_results: dict[str, tuple[list[NLIScore], VerdictBand]] | None = None,
) -> tuple[ArticleVerdict, str]:
    """Synthesise article verdict, optionally using pre-computed NLI scores.

    nli_results maps claim_id → (list[NLIScore], VerdictBand) and is populated
    by main.py after running batch NLI scoring per claim.
    """
    use_nli = bool(nli_results)
    schema = ArticleVerdict.model_json_schema()

    try:
        if use_nli and nli_results and claims:
            # ── NLI-guided path: one Sonnet call per claim, stance-sorted prompt ──
            all_passages = _extract_passages(evidence)
            all_passage_texts = [p for p, _ in all_passages]

            claim_verdicts: list[ClaimVerdict] = []
            for claim in claims:
                scores, band = nli_results.get(claim.id, ([], VerdictBand.INSUFFICIENT_EVIDENCE))

                # Reuse the per-claim NLI scores against the shared passage list
                passage_scores = scores if len(scores) == len(all_passages) else [NLIScore(entailment=0.0, contradiction=0.0, neutral=1.0, stance="neutral", confidence=0.0)] * len(all_passages)
                nli_prompt = _build_nli_prompt(claim, all_passages, passage_scores, band)

                try:
                    response = await client.messages.create(
                        model=model,
                        max_tokens=800,
                        temperature=0.1,
                        system=[
                            {
                                "type": "text",
                                "text": NLI_SYNTHESIS_SYSTEM_PROMPT,
                                "cache_control": {"type": "ephemeral"},
                            }
                        ],
                        messages=[
                            {
                                "role": "user",
                                "content": (
                                    f"{nli_prompt}\n\n"
                                    "Return a JSON object with exactly these fields:\n"
                                    '{"verdict_label": "true|mostly_true|mixed|mostly_false|false|unverified", '
                                    '"confidence": 0.0-1.0, "explanation": "one sentence with [S#] citations"}'
                                ),
                            }
                        ],
                    )
                    text = "\n".join(
                        b.text for b in response.content if getattr(b, "type", "") == "text"
                    ).strip()
                    parsed = _parse_json(text)
                    raw_label = parsed.get("verdict_label", "unverified")
                    try:
                        label = ClaimVerdictLabel(raw_label)
                    except ValueError:
                        label = ClaimVerdictLabel.UNVERIFIED
                    cv = ClaimVerdict(
                        claim_id=claim.id,
                        verdict=label,
                        confidence=float(parsed.get("confidence", 0.5)),
                        explanation=parsed.get("explanation", ""),
                        sources=_claim_sources(evidence),
                    )
                except Exception as exc:
                    logger.warning("Per-claim NLI synthesis failed for %s: %s", claim.id, exc)
                    cv = _fallback_claim_verdict(claim, evidence)

                cv = _nli_enriched_verdict(cv, scores, band)
                claim_verdicts.append(cv)

            band_from_score = _band_from_score(score.final_score, score.independent_signal_count)
            verdict = ArticleVerdict(
                score=score.final_score,
                band=band_from_score,
                confidence_band=_default_confidence_band(score.final_score, score.independent_signal_count),
                signals_fired=score.signals_fired,
                claim_verdicts=claim_verdicts,
            )
            return verdict, _analysis_markdown(verdict)

        # ── Standard path: single Sonnet call with full evidence blob ─────────
        payload = {
            "claims": [
                {
                    "id": c.id,
                    "text": c.text,
                    "claim_type": c.claim_type.value if hasattr(c.claim_type, "value") else c.claim_type,
                    "entities": [e.model_dump() for e in c.entities] if hasattr(c, "entities") else [],
                }
                for c in claims
            ],
            "evidence": evidence.model_dump(mode="json"),
            "heuristics": score.model_dump(),
        }

        response = await client.messages.create(
            model=model,
            max_tokens=3000,
            temperature=0.1,
            system=[
                {
                    "type": "text",
                    "text": SYNTHESIS_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Use this exact structured evidence and heuristics. "
                        "Never invent a source URL or publisher. "
                        "Return the article verdict using the provided tool.\n\n"
                        f"{json.dumps(payload)}"
                    ),
                }
            ],
            tools=[
                {
                    "name": SYNTHESIS_TOOL_NAME,
                    "description": "Return claim-level and article-level verdicts.",
                    "input_schema": schema,
                }
            ],
            tool_choice={"type": "tool", "name": SYNTHESIS_TOOL_NAME},
        )

        tool_payload = _extract_tool_input(response, SYNTHESIS_TOOL_NAME)
        if tool_payload is not None:
            verdict = ArticleVerdict.model_validate(tool_payload)
            return verdict, _analysis_markdown(verdict)

        text_blocks = [block.text for block in response.content if getattr(block, "type", "") == "text"]
        result_json = _parse_json("\n".join(text_blocks))
        verdict = ArticleVerdict.model_validate(result_json)
    except Exception:
        verdict = _fallback_article_verdict(claims, evidence, score)

    return verdict, _analysis_markdown(verdict)
