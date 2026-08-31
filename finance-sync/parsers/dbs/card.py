"""
DBS card transactions (Visa/Mastercard/NETS card, physical or contactless,
including tokenised cards in Google Wallet) -- TODO: no confirmed sample yet.

Card purchases show as pending first (held ~10 days pending merchant
settlement, dropped if never settled), then post. Card alerts default to a
S$500 threshold; once that threshold is set to S$0 (see README), one-off
purchases should alert regardless of amount -- recurring card charges still
won't (DBS never alerts for recurring transactions at any threshold).

To wire this up: forward yourself a real "digibank Alert - ..." card email,
redact it with redact_sample.py, paste the subject + body, and this file
gets rewritten against it. Likely needs both an authorisation template and a
settlement template -- the dedup/soft-merge logic in sync.py is built to
handle a purchase producing two emails for the same transaction.
"""
from ..base import Transaction


def matches(msg) -> bool:
    return False


def parse(msg) -> Transaction:  # pragma: no cover - no confirmed template yet
    raise NotImplementedError("dbs.card has no confirmed sample yet")
