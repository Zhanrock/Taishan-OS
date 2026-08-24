"""
Merchant substring -> category, best-effort auto-tagging at insert time.
Anything unmatched falls back to "uncategorized" and can be corrected later
in the Finance tab UI (which writes straight to finance_transactions.category).
Keep this list growing as you see real merchant names come through.
"""
KEYWORD_CATEGORIES = {
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
}


def categorize(merchant: str) -> str:
    lowered = (merchant or "").lower()
    for keyword, category in KEYWORD_CATEGORIES.items():
        if keyword in lowered:
            return category
    return "uncategorized"
