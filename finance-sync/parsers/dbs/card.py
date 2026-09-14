"""
DBS card transactions (Visa/Mastercard/NETS card, physical or contactless,
including tokenised cards in Google Wallet) -- confirmed against a real
"Card Transaction Alert" email (1 Sep, SGD5.00 at MCDONALD'S (NTU), card
ending 0000). Google Wallet transactions use this exact template -- DBS
does not send a separate wallet-specific alert.

Subject: "Card Transaction Alert"

This template fires once the transaction is completed ("We are pleased to
confirm that the transaction was completed") -- it is the settled/posted
confirmation, not a pending-authorisation notice. No separate
pending-authorisation template has been confirmed yet; if one turns up it
will need its own sub-parser plus the dedup/soft-merge handling in sync.py
(a purchase producing two emails for the same transaction).
"""
import re

from ..base import Transaction, get_body_text
from . import common

SUBJECT_RE = re.compile(r"Card Transaction Alert", re.IGNORECASE)


def matches(msg) -> bool:
    return bool(SUBJECT_RE.search(msg.get("Subject", "")))


def parse(msg) -> Transaction:
    subject = msg.get("Subject", "")
    body = get_body_text(msg)

    dt_match = common.DATETIME_RE.search(body)
    from_match = common.FROM_RE.search(body)
    to_match = common.TO_RE.search(body)

    from_line = from_match.group("party").strip() if from_match else ""
    to_line = to_match.group("party").strip() if to_match else ""
    direction = common.detect_direction(from_line, to_line)
    my_line = to_line if direction == "credit" else from_line
    counterparty_line = from_line if direction == "credit" else to_line

    email_date = common.safe_email_date(msg)
    dt_text = dt_match.group("datetime") if dt_match else None
    txn_date = common.resolve_txn_date(dt_text, email_date)
    txn_time = common.resolve_txn_time(dt_text, email_date)
    amount, currency = common.parse_amount(body)

    return Transaction(
        bank="dbs",
        account="DBS Main",
        account_mask=common.account_mask(my_line),
        txn_date=txn_date or (email_date.date().isoformat() if email_date else ""),
        txn_time=txn_time,
        amount=amount,
        currency=currency,
        direction=direction,
        merchant=common.strip_suffix(counterparty_line) or "Unknown",
        raw_subject=subject,
        txn_ref=common.txn_ref(body),
        status="posted",
        payment_method="card",
    )
