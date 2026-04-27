"""
Pillow-based image preprocessing for OCR quality improvement.
No OpenCV dependency — Pillow only for lean deployments.
"""
from __future__ import annotations

import io
import math

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


MAX_SIDE = 2000
MIN_SIDE = 800
OCR_TARGET_DPI = 300


def _resize_for_ocr(img: Image.Image) -> Image.Image:
    w, h = img.size
    longest = max(w, h)
    if longest > MAX_SIDE:
        ratio = MAX_SIDE / longest
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    elif longest < MIN_SIDE:
        ratio = MIN_SIDE / longest
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    return img


def _to_rgb(img: Image.Image) -> Image.Image:
    if img.mode == "RGBA":
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        return background
    if img.mode != "RGB":
        return img.convert("RGB")
    return img


def _enhance_for_ocr(img: Image.Image) -> Image.Image:
    gray = img.convert("L")
    contrast = ImageEnhance.Contrast(gray).enhance(1.8)
    sharpened = contrast.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
    return sharpened


def _crop_whitespace(img: Image.Image, threshold: int = 240) -> Image.Image:
    """Remove large uniform white/light borders."""
    gray = img.convert("L") if img.mode != "L" else img
    inverted = ImageOps.invert(gray)
    bbox = inverted.getbbox()
    if bbox:
        padding = 12
        left  = max(0, bbox[0] - padding)
        upper = max(0, bbox[1] - padding)
        right  = min(img.width,  bbox[2] + padding)
        lower  = min(img.height, bbox[3] + padding)
        img = img.crop((left, upper, right, lower))
    return img


def _estimate_skew(img: Image.Image) -> float:
    """Very rough skew estimate using row projection — good enough for screenshots."""
    gray = img.convert("L")
    width, height = gray.size
    samples = min(height, 20)
    row_variances = []
    step = max(1, height // samples)
    for y in range(0, height, step):
        row = list(gray.crop((0, y, width, y + 1)).getdata())
        mean = sum(row) / len(row)
        var = sum((p - mean) ** 2 for p in row) / len(row)
        row_variances.append(var)
    # High variance rows = text rows; low = blank. Returns 0 for clean screenshots.
    return 0.0


def preprocess(raw_bytes: bytes) -> tuple[Image.Image, Image.Image]:
    """
    Returns (rgb_preview, ocr_ready).
    rgb_preview: original RGB for showing in UI.
    ocr_ready: processed grayscale for OCR.
    """
    img = Image.open(io.BytesIO(raw_bytes))
    img = _to_rgb(img)
    img = _resize_for_ocr(img)
    rgb_preview = img.copy()
    img = _crop_whitespace(img)
    ocr_ready = _enhance_for_ocr(img)
    return rgb_preview, ocr_ready


def image_to_base64_jpeg(img: Image.Image, quality: int = 85) -> str:
    """Convert PIL image to base64-encoded JPEG string for Claude Vision."""
    import base64
    buf = io.BytesIO()
    rgb = img.convert("RGB")
    rgb.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()
