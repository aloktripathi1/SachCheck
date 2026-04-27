"""
OCR pipeline: Tesseract (primary) → Claude Vision (fallback).
Falls back to Claude only when Tesseract confidence < 55 % or is unavailable.
Claude Vision call ~$0.003 per image — used sparingly.
"""
from __future__ import annotations

import logging
import re

from PIL import Image

logger = logging.getLogger("sachcheck.ocr")


# ── Language detection ────────────────────────────────────────────────────────

def _detect_language(text: str) -> str:
    """Heuristic language detection without extra dependencies."""
    if not text.strip():
        return "unknown"
    devanagari = len(re.findall(r"[ऀ-ॿ]", text))
    total_alpha = len(re.findall(r"[a-zA-Zऀ-ॿ]", text))
    if total_alpha == 0:
        return "unknown"
    if devanagari / total_alpha > 0.3:
        return "hi"
    return "en"


# ── Tesseract OCR ─────────────────────────────────────────────────────────────

def _tesseract_ocr(img: Image.Image) -> tuple[str, float] | None:
    """Returns (text, confidence 0-1) or None if tesseract is unavailable."""
    try:
        import pytesseract  # type: ignore

        # eng+hin covers English, Hindi, Hinglish
        lang = "eng+hin"
        try:
            data = pytesseract.image_to_data(
                img,
                lang=lang,
                output_type=pytesseract.Output.DICT,
                config="--psm 6",
            )
        except Exception:
            data = pytesseract.image_to_data(
                img,
                lang="eng",
                output_type=pytesseract.Output.DICT,
                config="--psm 6",
            )

        pairs = [
            (text.strip(), int(conf))
            for text, conf in zip(data["text"], data["conf"])
            if text.strip() and int(conf) > 0
        ]
        if not pairs:
            return None

        avg_conf = sum(c for _, c in pairs) / len(pairs)
        full_text = " ".join(t for t, c in pairs if c >= 30)
        full_text = re.sub(r"\s{2,}", " ", full_text).strip()
        return full_text, avg_conf / 100.0

    except ImportError:
        logger.warning("pytesseract not installed; falling back to Claude Vision")
        return None
    except Exception as exc:
        logger.warning("Tesseract failed: %s", exc)
        return None


# ── Claude Vision OCR ─────────────────────────────────────────────────────────

async def _claude_vision_ocr(client, img: Image.Image) -> tuple[str, float]:
    """Extract text with Claude Vision. Returns (text, confidence 0-1)."""
    from pipeline.image_preprocessing import image_to_base64_jpeg

    b64 = image_to_base64_jpeg(img, quality=90)

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract ALL visible text from this image exactly as it appears. "
                            "Preserve line breaks. Do not summarise. Do not add commentary. "
                            "If no readable text is present, reply with: [NO TEXT FOUND]"
                        ),
                    },
                ],
            }
        ],
    )

    text = ""
    for block in message.content:
        if getattr(block, "type", "") == "text":
            text += block.text

    text = text.strip()
    if text == "[NO TEXT FOUND]" or not text:
        return "", 0.0

    # Claude Vision is high quality — assign 0.92 confidence
    return text, 0.92


# ── Public interface ──────────────────────────────────────────────────────────

class OCRResult:
    __slots__ = ("text", "confidence", "language", "method", "word_count")

    def __init__(
        self,
        text: str,
        confidence: float,
        language: str,
        method: str,
    ) -> None:
        self.text = text
        self.confidence = confidence
        self.language = language
        self.method = method
        self.word_count = len(text.split())

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "confidence": round(self.confidence, 3),
            "language": self.language,
            "method": self.method,
            "word_count": self.word_count,
        }


async def run_ocr(client, img: Image.Image) -> OCRResult:
    """
    Run OCR on a preprocessed PIL image.
    Strategy: Tesseract first (free) → Claude Vision if confidence < 55 %.
    """
    tess_result = _tesseract_ocr(img)

    if tess_result is not None:
        text, conf = tess_result
        if text and conf >= 0.55:
            lang = _detect_language(text)
            logger.info("Tesseract OCR: %.0f%% confidence, %d words", conf * 100, len(text.split()))
            return OCRResult(text=text, confidence=conf, language=lang, method="tesseract")
        logger.info("Tesseract confidence %.0f%% < 55%%; falling back to Claude Vision", conf * 100)

    # Claude Vision fallback
    logger.info("Using Claude Vision for OCR")
    text, conf = await _claude_vision_ocr(client, img)
    lang = _detect_language(text)
    return OCRResult(text=text, confidence=conf, language=lang, method="claude_vision")
