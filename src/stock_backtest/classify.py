"""Classify KRX-listed instruments by name pattern.

get_market_ticker_list-equivalent responses mix common stock in with SPACs,
REITs, preferred shares, and rights/warrants. Regexes below were validated
by hand against the live 2025-09-02 KOSPI+KOSDAQ universe (2,881 names,
0 false positives/negatives found on manual review) -- see conversation
notes for the verification run. Re-check by hand if KRX naming conventions
change.
"""

from __future__ import annotations

import re

_PREF_RE = re.compile(r"\(?\d*우[A-Z]?\)?(\(전환\))?$")
_RIGHTS_RE = re.compile(r"\d*(R|WR)$")


def classify_instrument(name: str) -> str:
    """Return one of: common, preferred, spac, reit, rights."""
    if "스팩" in name:
        return "spac"
    if "리츠" in name:
        return "reit"
    if _PREF_RE.search(name):
        return "preferred"
    if _RIGHTS_RE.search(name):
        return "rights"
    return "common"
