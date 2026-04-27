from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class ImageCheckCreateResponse(BaseModel):
    check_id: UUID


class ImageStreamEventType(str, Enum):
    PREPROCESSING   = "preprocessing"
    OCR_RUNNING     = "ocr_running"
    OCR_COMPLETE    = "ocr_complete"
    EXTRACTING      = "extracting"
    CLAIM_FOUND     = "claim_found"
    GATHERING       = "gathering"
    EVIDENCE_READY  = "evidence_ready"
    SIGNALS         = "signals"
    SIGNALS_READY   = "signals_ready"
    SYNTHESIZING    = "synthesizing"
    VERDICT         = "verdict"
    DONE            = "done"
    ERROR           = "error"
