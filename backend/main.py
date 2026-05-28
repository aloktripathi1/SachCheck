from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette import EventSourceResponse

from models.image_schemas import ImageCheckCreateResponse, ImageStreamEventType
from models.schemas import CheckCreateResponse, CheckRequest, PipelineInput, StreamEventType
from pipeline.evidence import gather_evidence, is_evidence_sufficient
from pipeline.extractor import extract_claims
from pipeline.image_pipeline import run_image_pipeline
from pipeline.nli_scorer import batch_score_passages, compute_verdict_band
from pipeline.scorer import score_article
from pipeline.synthesizer import synthesize
from utils.scraper import is_probable_url, scrape_url


load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("sachcheck")

app = FastAPI(title="SachCheck API", version="1.0.0")
anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_CHECK_TTL_SECONDS = 600


@dataclass
class CheckState:
    queue: asyncio.Queue[dict[str, Any]] = field(default_factory=asyncio.Queue)
    done: asyncio.Event = field(default_factory=asyncio.Event)
    created_at: float = field(default_factory=time.monotonic)


check_states: dict[UUID, CheckState] = {}
image_check_states: dict[UUID, CheckState] = {}

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"}
_MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


async def _reap_stale_states() -> None:
    while True:
        await asyncio.sleep(120)
        now = time.monotonic()
        stale = [cid for cid, state in check_states.items() if now - state.created_at > _CHECK_TTL_SECONDS]
        for cid in stale:
            check_states.pop(cid, None)
        img_stale = [cid for cid, state in image_check_states.items() if now - state.created_at > _CHECK_TTL_SECONDS]
        for cid in img_stale:
            image_check_states.pop(cid, None)
        total = len(stale) + len(img_stale)
        if total:
            logger.info("Reaped %d stale check state(s)", total)


@app.on_event("startup")
async def _startup() -> None:
    asyncio.create_task(_reap_stale_states())


async def _publish(check_id: UUID, event: StreamEventType, data: dict[str, Any]) -> None:
    state = check_states.get(check_id)
    if not state:
        return
    await state.queue.put({"event": event.value, "data": data})


async def _run_pipeline(check_id: UUID, pipeline_input: PipelineInput) -> None:
    try:
        extraction = await extract_claims(
            anthropic_client,
            pipeline_input.article_text,
            model=os.getenv("ANTHROPIC_EXTRACT_MODEL", "claude-haiku-4-5-20251001"),
        )

        for claim in extraction.claims:
            await _publish(
                check_id,
                StreamEventType.CLAIM_EXTRACTED,
                {
                    "claim": claim.model_dump(mode="json"),
                    "log": f"Extracted {claim.id}",
                },
            )

        # Emit web_search_triggered before gather so the frontend can show it
        # immediately if Tier-1 evidence is likely to be sparse. We fire it
        # unconditionally here; the gate inside gather_evidence decides whether
        # the search actually runs.
        await _publish(
            check_id,
            StreamEventType.WEB_SEARCH_TRIGGERED,
            {
                "reason": "checking_tier1_sufficiency",
                "log": "Starting evidence gathering; web search standby",
            },
        )

        evidence = await gather_evidence(
            query_text=pipeline_input.article_text[:500],
            entities=extraction.entities,
            claim_texts=[claim.text for claim in extraction.claims],
            google_api_key=os.getenv("GOOGLE_FC_API_KEY"),
            claimbuster_api_key=os.getenv("CLAIMBUSTER_API_KEY"),
            google_cse_api_key=os.getenv("GOOGLE_CSE_API_KEY"),
            google_cse_id=os.getenv("GOOGLE_CSE_ID"),
        )

        web_search_fired = evidence.source_health.web_search != "skipped"
        if web_search_fired:
            sources_used = [r.source for r in evidence.web_results]
            unique_sources = sorted(set(sources_used))
            await _publish(
                check_id,
                StreamEventType.WEB_SEARCH_COMPLETE,
                {
                    "results_count": len(evidence.web_results),
                    "sources": unique_sources,
                    "log": f"Web search fallback returned {len(evidence.web_results)} result(s)",
                },
            )

        await _publish(
            check_id,
            StreamEventType.SOURCE_RESULTS,
            {
                "source_health": evidence.source_health.model_dump(),
                "log": "Evidence fetched from Google Fact Check, Wikipedia, GDELT, ClaimBuster"
                + (", web search" if web_search_fired else ""),
            },
        )

        score = await score_article(
            source_url=str(pipeline_input.source_url) if pipeline_input.source_url else None,
            title=pipeline_input.title,
            article_text=pipeline_input.article_text,
            author_byline_present=pipeline_input.author_byline_present,
            evidence=evidence,
        )

        # ── NLI scoring: score all evidence passages against each claim ──────
        tier1_all_empty = (
            len(evidence.google_fact_check.reviews) == 0
            and not evidence.wikipedia
            and evidence.gdelt.volume == 0
        )

        # Collect all passage texts once; reuse across claims
        from pipeline.synthesizer import _extract_passages
        all_passages = _extract_passages(evidence)
        passage_texts = [p for p, _ in all_passages]

        nli_results: dict = {}
        for claim in extraction.claims:
            try:
                scores = await batch_score_passages(claim.text, passage_texts)
                max_support = max((s.entailment for s in scores), default=0.0)
                max_refute  = max((s.contradiction for s in scores), default=0.0)
                n_supporting    = sum(1 for s in scores if s.stance == "supports")
                n_contradicting = sum(1 for s in scores if s.stance == "contradicts")
                band = compute_verdict_band(
                    max_support=max_support,
                    max_refute=max_refute,
                    n_supporting=n_supporting,
                    n_contradicting=n_contradicting,
                    tier1_all_empty=tier1_all_empty,
                )
                nli_results[claim.id] = (scores, band)
                await _publish(
                    check_id,
                    StreamEventType.NLI_SCORED,
                    {
                        "claim_id": claim.id,
                        "supporting": n_supporting,
                        "contradicting": n_contradicting,
                        "neutral": len(scores) - n_supporting - n_contradicting,
                        "verdict_band": band.value,
                    },
                )
            except Exception:
                logger.exception("NLI scoring failed for claim %s", claim.id)
                nli_results[claim.id] = ([], None)

        verdict, markdown = await synthesize(
            anthropic_client,
            claims=extraction.claims,
            evidence=evidence,
            score=score,
            model=os.getenv("ANTHROPIC_SYNTHESIS_MODEL", "claude-sonnet-4-6"),
            nli_results=nli_results if nli_results else None,
        )

        for token in markdown.split(" "):
            await _publish(
                check_id,
                StreamEventType.SOURCE_RESULTS,
                {"stream_token": token + " "},
            )

        await _publish(
            check_id,
            StreamEventType.VERDICT,
            {
                "article_verdict": verdict.model_dump(mode="json"),
                "claims_found": len(extraction.claims) + len(extraction.skipped_claims),
                "claims_verified": len(extraction.claims),
                "claims_skipped": len(extraction.skipped_claims),
                "disclaimer": (
                    "This is an automated heuristic credibility estimate. It is not a determination of truth. "
                    "Always consult primary sources and the cited fact-checks below."
                ),
            },
        )
    except Exception:
        logger.exception("Verification pipeline failed for check_id=%s", check_id)
        await _publish(
            check_id,
            StreamEventType.ERROR,
            {"message": "SachCheck could not complete this verification run."},
        )
    finally:
        await _publish(check_id, StreamEventType.DONE, {"status": "complete"})
        state = check_states.get(check_id)
        if state:
            state.done.set()


@app.post("/check", response_model=CheckCreateResponse)
async def create_check(payload: CheckRequest) -> CheckCreateResponse:
    check_id = uuid4()

    try:
        if is_probable_url(payload.input):
            scrape = await scrape_url(payload.input)
            pipeline_input = PipelineInput(
                raw_input=payload.input,
                source_url=scrape.source_url,
                article_text=scrape.text_for_analysis,
                title=scrape.title,
                author_byline_present=scrape.author_byline_present,
            )
        else:
            pipeline_input = PipelineInput(
                raw_input=payload.input,
                article_text=payload.input,
            )
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse the provided URL or text input.")

    state = CheckState()
    check_states[check_id] = state
    asyncio.create_task(_run_pipeline(check_id, pipeline_input))

    return CheckCreateResponse(check_id=check_id)


@app.get("/check/{check_id}/stream")
async def stream_check(check_id: UUID) -> EventSourceResponse:
    state = check_states.get(check_id)
    if not state:
        raise HTTPException(status_code=404, detail="Check ID not found")

    async def event_generator() -> Any:
        try:
            while True:
                event = await state.queue.get()
                yield {
                    "event": event["event"],
                    "data": json.dumps(event["data"]),
                }
                if event["event"] == StreamEventType.DONE.value:
                    break
        finally:
            check_states.pop(check_id, None)

    return EventSourceResponse(event_generator())


async def _publish_image(check_id: UUID, event: ImageStreamEventType, data: dict) -> None:
    state = image_check_states.get(check_id)
    if not state:
        return
    await state.queue.put({"event": event.value, "data": data})


@app.post("/image-check", response_model=ImageCheckCreateResponse)
async def create_image_check(file: UploadFile = File(...)) -> ImageCheckCreateResponse:
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported image type: {content_type}")

    image_bytes = await file.read()
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Image file appears to be empty")

    check_id = uuid4()
    state = CheckState()
    image_check_states[check_id] = state

    asyncio.create_task(
        run_image_pipeline(
            check_id=check_id,
            image_bytes=image_bytes,
            publish=_publish_image,
            client=anthropic_client,
        )
    )

    return ImageCheckCreateResponse(check_id=check_id)


@app.get("/image-check/{check_id}/stream")
async def stream_image_check(check_id: UUID) -> EventSourceResponse:
    state = image_check_states.get(check_id)
    if not state:
        raise HTTPException(status_code=404, detail="Image check ID not found")

    async def event_generator() -> Any:
        try:
            while True:
                event = await state.queue.get()
                yield {"event": event["event"], "data": json.dumps(event["data"])}
                if event["event"] == ImageStreamEventType.DONE.value:
                    break
        finally:
            image_check_states.pop(check_id, None)

    return EventSourceResponse(event_generator())


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
