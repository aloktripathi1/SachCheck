from __future__ import annotations

import json
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
    SourceRef,
)


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


async def synthesize(
    client: AsyncAnthropic,
    claims: list[AtomicClaim],
    evidence: EvidenceBundle,
    score: HeuristicScore,
    model: str = "claude-sonnet-4-6",
) -> tuple[ArticleVerdict, str]:
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

    schema = ArticleVerdict.model_json_schema()

    try:
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
