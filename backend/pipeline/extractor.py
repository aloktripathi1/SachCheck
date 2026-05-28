from __future__ import annotations

import json
import re
from typing import Any

from anthropic import AsyncAnthropic

from models.schemas import AtomicClaim, ClaimType, EntityTag, ExtractionResult

MAX_CLAIMS_PER_CHECK = 10

EXTRACTION_SYSTEM_PROMPT = """\
You are an atomic claim extractor. Given a passage of text, extract every independently verifiable factual claim.

Rules:
1. Each claim must be a single proposition with exactly one verb.
2. Replace ALL pronouns with their explicit referents from context.
3. Tag entities inline: [PERSON:name], [ORG:name], [LOC:name], [DATE:value], [QUANTITY:value with unit].
4. Skip: opinions, predictions, personal experiences, rhetorical questions, satire.
5. For each claim, classify its type as one of: statistical | historical | attributed_quote | biographical | scientific | causal | policy.
6. Output ONLY a JSON array. No preamble, no explanation.

Output schema per claim:
{
  "id": integer,
  "claim": "string — the decontextualized atomic claim",
  "entities": [{"text": "string", "type": "PERSON|ORG|LOC|DATE|QUANTITY"}],
  "claim_type": "statistical|historical|attributed_quote|biographical|scientific|causal|policy",
  "check_worthy": true|false,
  "reason_if_not": "string or null"
}"""

_OPINION_MARKERS = frozenset([
    "i think", "i believe", "in my opinion", "perhaps", "maybe", "might be",
    "seems like", "seems to", "probably", "arguably", "allegedly",
])
_VERB_PATTERN = re.compile(
    r"\b(is|are|was|were|has|have|had|will|did|does|do|said|announced|reported|"
    r"stated|found|discovered|confirmed|denied|claimed|showed|revealed|increased|"
    r"decreased|launched|signed|passed|approved|rejected|died|born|founded|won|lost|"
    r"happened|occurred|began|ended|started|finished|became|made|took|gave|left|"
    r"reached|achieved|received|produced|caused|led|resulted|included|contained|"
    r"remained|returned|became|set|held|hit|cut|raised|lowered|opened|closed)\b",
    re.IGNORECASE,
)
_ENTITY_INLINE_PATTERN = re.compile(r"\[(?:PERSON|ORG|LOC|DATE|QUANTITY):([^\]]+)\]")
_INLINE_TYPE_PATTERN = re.compile(r"\[(PERSON|ORG|LOC|DATE|QUANTITY):([^\]]+)\]")


def _heuristic_extract(article_text: str) -> ExtractionResult:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", article_text) if len(s.strip()) > 25]

    check_worthy: list[AtomicClaim] = []
    skipped: list[AtomicClaim] = []

    for i, sentence in enumerate(sentences, start=1):
        claim_id = f"claim_{i}"
        lower = sentence.lower()

        is_worthy = True
        reason: str | None = None

        if "?" in sentence:
            is_worthy = False
            reason = "rhetorical or genuine question"
        elif any(marker in lower for marker in _OPINION_MARKERS):
            is_worthy = False
            reason = "opinion or hedged statement"
        elif not _VERB_PATTERN.search(sentence):
            is_worthy = False
            reason = "no verifiable verb"

        entities = [
            EntityTag(text=m.group(2), type=m.group(1))
            for m in _INLINE_TYPE_PATTERN.finditer(sentence)
        ]
        named = sorted({m.group() for m in re.finditer(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b", sentence)})
        if not entities and named:
            entities = [EntityTag(text=n, type="PERSON") for n in named[:3]]

        claim = AtomicClaim(
            id=claim_id,
            text=sentence,
            entity=named[0] if named else None,
            entities=entities,
            claim_type=ClaimType.HISTORICAL,
            check_worthy=is_worthy,
            reason_if_not=reason,
        )
        if is_worthy and len(check_worthy) < MAX_CLAIMS_PER_CHECK:
            check_worthy.append(claim)
        else:
            if not is_worthy:
                skipped.append(claim)

    all_entities = sorted({
        m.group()
        for m in re.finditer(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b", article_text)
    })[:30]

    return ExtractionResult(claims=check_worthy, skipped_claims=skipped, entities=all_entities)


def _parse_raw_json(text: str) -> list[dict[str, Any]]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def _build_atomic_claim(raw: dict[str, Any], index: int) -> AtomicClaim:
    raw_id = raw.get("id", index)
    claim_id = f"claim_{raw_id}"

    raw_entities = raw.get("entities") or []
    entities = [
        EntityTag(text=e.get("text", ""), type=e.get("type", "PERSON"))
        for e in raw_entities
        if isinstance(e, dict) and e.get("text")
    ]

    # Primary entity: first PERSON, fall back to first entity of any type
    primary_entity: str | None = None
    for e in entities:
        if e.type == "PERSON":
            primary_entity = e.text
            break
    if primary_entity is None and entities:
        primary_entity = entities[0].text

    raw_type = raw.get("claim_type", "historical")
    try:
        claim_type = ClaimType(raw_type)
    except ValueError:
        claim_type = ClaimType.HISTORICAL

    return AtomicClaim(
        id=claim_id,
        text=raw.get("claim", ""),
        entity=primary_entity,
        entities=entities,
        claim_type=claim_type,
        check_worthy=bool(raw.get("check_worthy", True)),
        reason_if_not=raw.get("reason_if_not") or None,
    )


async def extract_claims(
    client: AsyncAnthropic,
    article_text: str,
    model: str = "claude-haiku-4-5-20251001",
) -> ExtractionResult:
    try:
        message = await client.messages.create(
            model=model,
            max_tokens=2000,
            temperature=0,
            system=[
                {
                    "type": "text",
                    "text": EXTRACTION_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Extract all atomic, independently verifiable factual claims "
                        "from the text below. Follow the rules exactly.\n\n"
                        f"{article_text}"
                    ),
                }
            ],
        )

        text_blocks = [
            block.text
            for block in message.content
            if getattr(block, "type", "") == "text"
        ]
        raw_text = "\n".join(text_blocks).strip()

        raw_list = _parse_raw_json(raw_text)
        if not isinstance(raw_list, list):
            raise ValueError("Expected a JSON array")

        all_claims = [_build_atomic_claim(item, i + 1) for i, item in enumerate(raw_list) if isinstance(item, dict)]

        check_worthy = [c for c in all_claims if c.check_worthy]
        skipped = [c for c in all_claims if not c.check_worthy]

        # Re-index check-worthy claims so IDs are dense (claim_1, claim_2, …)
        # and cap at MAX_CLAIMS_PER_CHECK
        capped_worthy = check_worthy[:MAX_CLAIMS_PER_CHECK]
        overflow = check_worthy[MAX_CLAIMS_PER_CHECK:]
        for i, claim in enumerate(capped_worthy, start=1):
            claim.id = f"claim_{i}"
        for i, claim in enumerate(overflow, start=len(capped_worthy) + 1):
            claim.id = f"claim_{i}"

        all_entity_texts = sorted({
            e.text
            for c in all_claims
            for e in c.entities
        })

        return ExtractionResult(
            claims=capped_worthy,
            skipped_claims=skipped + overflow,
            entities=all_entity_texts,
        )

    except Exception:
        return _heuristic_extract(article_text)
