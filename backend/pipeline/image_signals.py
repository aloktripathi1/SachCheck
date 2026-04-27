"""
Rule-based misinformation signal detection for image text.
Pure Python — no ML dependencies. Fast, deterministic, auditable.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class ManipulationSignal:
    signal: str
    label: str
    description: str
    severity: str        # "high" | "medium" | "low"
    fired: bool
    weight: int          # negative = credibility-reducing
    category: str        # "formatting" | "linguistic" | "source" | "structural"

    def to_dict(self) -> dict:
        return {
            "signal": self.signal,
            "label": self.label,
            "description": self.description,
            "severity": self.severity,
            "fired": self.fired,
            "weight": self.weight,
            "category": self.category,
        }


# ── Word lists ────────────────────────────────────────────────────────────────

_URGENCY = [
    "BREAKING", "URGENT", "EXCLUSIVE", "SHOCKING", "VIRAL", "EXPOSED",
    "WARNING", "ALERT", "EMERGENCY", "BOMBSHELL", "LEAKED", "BUSTED",
]
_FORWARD_PROMPTS = [
    r"\bsend this\b", r"\bforward this\b", r"\bshare this\b",
    r"\bspread the (word|news|truth)\b", r"\bpass this on\b",
    r"\beveryone must (know|see)\b", r"\btell everyone\b",
    r"\bplease share\b", r"\bdo not ignore\b",
]
_EMOTIONAL = [
    r"\boutrage\b", r"\bdisgust(ing)?\b", r"\bhorr(ific|ible|ified)\b",
    r"\bunbelievable\b", r"\bmust (see|read|watch|share)\b",
    r"\bsickening\b", r"\bshocking\b", r"\bstunning\b",
]
_FAKE_AUTHORITY = [
    r"\bofficial (notice|alert|order)\b", r"\bgovernment (order|notice|announcement)\b",
    r"\bprime minister (announced|declared|said)\b",
    r"\bsupreme court (order|notice)\b", r"\bwho (confirms|says|declared)\b",
    r"\bun (warns|declares|confirms)\b",
]
_NO_DATE_PATTERN = r"\b(19|20)\d{2}\b"
_SOURCE_PATTERN  = r"(source[s]?[\s:]+|according to|reported by|cited by|published (in|by)|via\s+\w)"


def detect_signals(text: str) -> list[ManipulationSignal]:
    if not text:
        return _empty_signals()

    signals: list[ManipulationSignal] = []
    t_upper = text.upper()
    t_lower = text.lower()

    # ── 1. Excessive caps ────────────────────────────────────────────────────
    alpha_chars = [c for c in text if c.isalpha()]
    upper_ratio = sum(1 for c in alpha_chars if c.isupper()) / max(len(alpha_chars), 1)
    sev = "high" if upper_ratio > 0.55 else "medium" if upper_ratio > 0.30 else "low"
    signals.append(ManipulationSignal(
        signal="excessive_caps",
        label="Excessive Capital Letters",
        description=f"{upper_ratio:.0%} of text is uppercase — common in panic-inducing misinformation.",
        severity=sev,
        fired=upper_ratio > 0.30,
        weight=-15 if upper_ratio > 0.55 else (-8 if upper_ratio > 0.30 else 0),
        category="formatting",
    ))

    # ── 2. Urgency language ─────────────────────────────────────────────────
    hits = [w for w in _URGENCY if w in t_upper]
    signals.append(ManipulationSignal(
        signal="urgency_language",
        label="Urgency / Fear Language",
        description=f"Contains urgency trigger words: {', '.join(hits[:4]) if hits else 'none'}.",
        severity="high" if len(hits) >= 3 else "medium" if hits else "low",
        fired=bool(hits),
        weight=-12 if len(hits) >= 3 else (-6 if hits else 0),
        category="linguistic",
    ))

    # ── 3. Forward prompts ──────────────────────────────────────────────────
    fwd_matches = [p for p in _FORWARD_PROMPTS if re.search(p, t_lower)]
    signals.append(ManipulationSignal(
        signal="forward_prompt",
        label='"Forward / Share" Prompt',
        description="Explicitly urges forwarding — a hallmark of viral misinformation chains.",
        severity="high",
        fired=bool(fwd_matches),
        weight=-20 if fwd_matches else 0,
        category="linguistic",
    ))

    # ── 4. No source attribution ─────────────────────────────────────────────
    has_source = bool(re.search(_SOURCE_PATTERN, t_lower))
    signals.append(ManipulationSignal(
        signal="no_source_attribution",
        label="No Source Attribution",
        description="Text makes claims without crediting any publication or reporter.",
        severity="medium",
        fired=not has_source,
        weight=-10 if not has_source else 0,
        category="source",
    ))

    # ── 5. Fake authority ───────────────────────────────────────────────────
    auth_hits = [p for p in _FAKE_AUTHORITY if re.search(p, t_lower)]
    signals.append(ManipulationSignal(
        signal="fake_authority",
        label="Unverified Authority Claim",
        description="References government / official body without a verifiable source link.",
        severity="high",
        fired=bool(auth_hits),
        weight=-18 if auth_hits else 0,
        category="structural",
    ))

    # ── 6. No date ──────────────────────────────────────────────────────────
    has_date = bool(re.search(_NO_DATE_PATTERN, text))
    signals.append(ManipulationSignal(
        signal="no_date",
        label="No Date / Year Found",
        description="Old images recycled with new narratives often omit or hide the original date.",
        severity="low",
        fired=not has_date,
        weight=-5 if not has_date else 0,
        category="structural",
    ))

    # ── 7. Emotional manipulation ────────────────────────────────────────────
    emo_hits = [p for p in _EMOTIONAL if re.search(p, t_lower)]
    signals.append(ManipulationSignal(
        signal="emotional_manipulation",
        label="Emotional Manipulation Language",
        description="Uses charged emotional wording designed to bypass critical thinking.",
        severity="medium",
        fired=bool(emo_hits),
        weight=-8 if emo_hits else 0,
        category="linguistic",
    ))

    # ── 8. Satire risk ───────────────────────────────────────────────────────
    satire_re = r"\b(satire|parody|joke|not real|fictional|onion)\b"
    is_satire = bool(re.search(satire_re, t_lower))
    signals.append(ManipulationSignal(
        signal="satire_indicator",
        label="Possible Satire Indicator",
        description="Text contains words suggesting satire or parody — verify before sharing.",
        severity="medium",
        fired=is_satire,
        weight=-5 if is_satire else 0,
        category="structural",
    ))

    # ── 9. Positive credibility signals ─────────────────────────────────────
    trust_domains = [
        r"\b(reuters|bbc|apnews|associated press|ndtv|the hindu|hindustan times)\b",
    ]
    has_trusted = any(re.search(p, t_lower) for p in trust_domains)
    signals.append(ManipulationSignal(
        signal="trusted_outlet_mention",
        label="Trusted Outlet Referenced",
        description="References a known credible news outlet.",
        severity="low",
        fired=has_trusted,
        weight=10 if has_trusted else 0,
        category="source",
    ))

    return signals


def _empty_signals() -> list[ManipulationSignal]:
    return [ManipulationSignal(
        signal="no_text",
        label="No Text Detected",
        description="Could not extract text from image for signal analysis.",
        severity="low",
        fired=True,
        weight=0,
        category="structural",
    )]


def compute_signal_score(signals: list[ManipulationSignal]) -> int:
    """Returns 0-100 where higher = more suspicious."""
    total_weight = sum(abs(s.weight) for s in signals if s.fired and s.weight < 0)
    return min(100, total_weight)
