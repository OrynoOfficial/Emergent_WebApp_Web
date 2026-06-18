"""Text-matching helpers for service search filters.

Centralised so every service (hotels, restaurants, car rentals, banquets,
laundries, …) uses the same accent + case insensitive city/name matching.
MongoDB's regex does not honour diacritic-insensitive collation natively, so
we expand each vowel into a Unicode character class.
"""
from __future__ import annotations

import re
import unicodedata


_ACCENT_CLASSES = {
    "a": "[aàáâãäå]",
    "e": "[eéèêë]",
    "i": "[iíìîï]",
    "o": "[oóòôõö]",
    "u": "[uúùûü]",
    "c": "[cç]",
    "n": "[nñ]",
    "y": "[yýÿ]",
}


def accent_insensitive_pattern(s: str) -> str:
    """Return a regex pattern that matches ``s`` ignoring accents and case.

    Example: ``Yaounde`` → matches ``Yaoundé``; ``douala`` → matches ``Douala``.
    """
    folded = "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )
    return "".join(_ACCENT_CLASSES.get(c.lower(), re.escape(c)) for c in folded)


def ci_regex_query(s: str) -> dict:
    """Convenience builder for a Mongo regex filter that's case + accent insensitive."""
    return {"$regex": accent_insensitive_pattern(s), "$options": "i"}
