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
    "sbs transit": "transport",

    # Singapore -- F&B chains
    "mcdonald": "food",
    "kfc": "food",
    "burger king": "food",
    "subway": "food",
    "pizza hut": "food",
    "domino": "food",
    "toast box": "food",
    "ya kun": "food",
    "old chang kee": "food",
    "breadtalk": "food",
    "din tai fung": "food",
    "swensen": "food",
    "crystal jade": "food",
    "astons": "food",
    "long john silver": "food",
    "popeyes": "food",
    "jollibee": "food",
    "mos burger": "food",

    # Singapore -- supermarkets
    "prime supermarket": "groceries",
    "don don donki": "groceries",
    "donki": "groceries",
    "meidi-ya": "groceries",

    # Singapore -- retail
    "uniqlo": "shopping",
    "muji": "shopping",
    "ikea": "shopping",
    "courts": "shopping",
    "challenger": "shopping",
    "popular bookstore": "shopping",
    "daiso": "shopping",
    "decathlon": "shopping",

    # Singapore -- entertainment
    "golden village": "entertainment",
    "cathay cineplex": "entertainment",
    "shaw theatres": "entertainment",
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
