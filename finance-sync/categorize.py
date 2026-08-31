"""
Merchant substring -> category, best-effort auto-tagging at insert time.
Anything unmatched falls back to "uncategorized" and can be corrected later
in the Finance tab UI (which writes straight to finance_transactions.category).
Keep this list growing as you see real merchant names come through.

DBS merchant strings are uppercase legal entity names (e.g. "POKKA PTE LTD")
-- strip_legal_suffix() removes the boilerplate before matching or display.
"""
import re

KEYWORD_CATEGORIES = {
    # Thailand (Kasikorn)
    "7-eleven": "food",
    "seven eleven": "food",
    "starbucks": "food",
    "grab": "transport",
    "bts": "transport",
    "mrt": "transport",
    "lotus": "groceries",
    "big c": "groceries",
    "tesco": "groceries",
    "netflix": "subscriptions",
    "spotify": "subscriptions",
    "true move": "bills",
    "truemove": "bills",

    # Singapore (DBS)
    "ntuc fairprice": "groceries",
    "fairprice": "groceries",
    "cold storage": "groceries",
    "giant": "groceries",
    "sheng siong": "groceries",
    "kopitiam": "food",
    "koufu": "food",
    "pokka": "food",
    "gojek": "transport",
    "comfortdelgro": "transport",
    "simplygo": "transport",
    "transitlink": "transport",
    "ez-link": "transport",
    "ezlink": "transport",
    "sp group": "bills",
    "singtel": "bills",
    "starhub": "bills",
    "m1": "bills",
    "shopee": "shopping",
    "lazada": "shopping",
    "guardian": "health",
    "watsons": "health",
    "unity": "health",
    "foodpanda": "food",
    "deliveroo": "food",
    "shell": "transport",
    "esso": "transport",
    "caltex": "transport",
}

_LEGAL_SUFFIX_RE = re.compile(
    r"\b(PTE\.?\s*LTD\.?|LLP|SINGAPORE)\b\.?", re.IGNORECASE
)


def strip_legal_suffix(merchant: str) -> str:
    """Strip common Singapore legal-entity suffixes so 'POKKA PTE LTD'
    matches and displays as 'POKKA'."""
    cleaned = _LEGAL_SUFFIX_RE.sub("", merchant or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def categorize(merchant: str) -> str:
    lowered = strip_legal_suffix(merchant).lower()
    for keyword, category in KEYWORD_CATEGORIES.items():
        if keyword in lowered:
            return category
    return "uncategorized"
