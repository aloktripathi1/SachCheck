from __future__ import annotations

import json
import re
from typing import Any

from anthropic import AsyncAnthropic

from models.schemas import Claim, ExtractionResult


EXTRACTION_TOOL_NAME = "return_extraction_result"

EXTRACTION_SYSTEM_PROMPT = (
    "You are a claim extraction engine. Extract only atomic, independently "
    "verifiable factual claims from the provided text. Exclude opinions, "
    "questions, and descriptive/contextual statements. For each claim, "
    "distill it to a single verifiable statement. Extract named entities "
    "(people, organizations, places) relevant to the claims. Return only "
    "the JSON schema provided. Do not add commentary."
)


def _heuristic_extract(article_text: str) -> ExtractionResult:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", article_text) if len(s.strip()) > 25]

    filtered: list[str] = []
    for sentence in sentences:
        lower = sentence.lower()
        if "?" in sentence:
            continue
        if any(marker in lower for marker in ["i think", "opinion", "perhaps", "maybe", "seems like"]):
            continue
        if not re.search(r"\b(is|are|was|were|has|have|had|will|did|announced|reported|said)\b", lower):
            continue
        filtered.append(sentence)

    filtered = filtered[:12]
    claims = [Claim(id=f"claim_{i+1}", text=text, entity=None) for i, text in enumerate(filtered)]
    entities = sorted(set(re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b", article_text)))[:30]
    return ExtractionResult(claims=claims, entities=entities)


def _parse_anthropic_json(payload_text: str) -> dict[str, Any]:
    payload_text = payload_text.strip()
    if payload_text.startswith("```"):
        payload_text = payload_text.strip("`")
        payload_text = payload_text.replace("json", "", 1).strip()
    return json.loads(payload_text)


def _extract_tool_input(message: Any, tool_name: str) -> dict[str, Any] | None:
    for block in message.content:
        if getattr(block, "type", "") == "tool_use" and getattr(block, "name", "") == tool_name:
            tool_input = getattr(block, "input", None)
            if isinstance(tool_input, dict):
                return tool_input
    return None


async def extract_claims(
    client: AsyncAnthropic,
    article_text: str,
    model: str = "claude-haiku-4-5-20251001",
) -> ExtractionResult:
    schema = ExtractionResult.model_json_schema()

    try:
        message = await client.messages.create(
            model=model,
            max_tokens=1500,
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
                        "Extract claims and entities from this text:\n\n"
                        f"{article_text}\n\n"
                        "Return the extraction result using the provided tool."
                    ),
                }
            ],
            tools=[
                {
                    "name": EXTRACTION_TOOL_NAME,
                    "description": "Return extracted claims and named entities.",
                    "input_schema": schema,
                }
            ],
            tool_choice={"type": "tool", "name": EXTRACTION_TOOL_NAME},
        )

        tool_payload = _extract_tool_input(message, EXTRACTION_TOOL_NAME)
        if tool_payload is not None:
            return ExtractionResult.model_validate(tool_payload)

        text_blocks = [block.text for block in message.content if getattr(block, "type", "") == "text"]
        payload_text = "\n".join(text_blocks).strip()
        payload = _parse_anthropic_json(payload_text)
        return ExtractionResult.model_validate(payload)
    except Exception:
        return _heuristic_extract(article_text)
