"""
DBS NETS Scan & Pay -- confirmed against a live email (31 Aug, S$1.20 at
Pokka). This is the fix for the actual bug: NETS Scan & Pay emails were
being rejected by the old single-parser dbs.py (which required the literal
string "paynow" in the body) and silently dropped.

Subject: "digibank Alert - Successful NETS Scan & Pay"

Sent immediately regardless of amount -- app-initiated QR payments are
digital transactions, not card-network transactions, so DBS's S$500 card
threshold does not apply here (confirmed: this exact template fired at
S$1.20). Always posted immediately, never pending.
"""
import re

from ..base import Transaction, get_body_text
from . import common

SUBJECT_RE = re.compile(r"Successful NETS Scan & Pay", re.IGNORECASE)


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
    txn_date = common.resolve_txn_date(
        dt_match.group("datetime") if dt_match else None, email_date
    )
    amount, currency = common.parse_amount(body)

    return Transaction(
        bank="dbs",
        account_mask=common.account_mask(my_line),
        txn_date=txn_date or (msg.get("Date", "") or ""),
        amount=amount,
        currency=currency,
        direction=direction,
        merchant=common.strip_suffix(counterparty_line) or "Unknown",
        raw_subject=subject,
        txn_ref=common.txn_ref(body),
        status="posted",
        payment_method="nets_qr",
    )
