"""
DBS PayNow transfer confirmations.

Matched by body content ("paynow") rather than subject -- confirmed against
a real email that this template's Subject is the generic "iBanking Alerts",
which carries no transaction-type information at all. Do not switch this to
subject-based dispatch; it cannot work for this template.
"""
from ..base import Transaction, get_body_text
from . import common


def matches(msg) -> bool:
    return "paynow" in get_body_text(msg).lower()


def parse(msg) -> Transaction:
    subject = msg.get("Subject", "")
    body = get_body_text(msg)

    from_match = common.FROM_RE.search(body)
    to_match = common.TO_RE.search(body)
    from_line = from_match.group("party").strip() if from_match else ""
    to_line = to_match.group("party").strip() if to_match else ""

    email_date = common.safe_email_date(msg)
    received = common.parse_received_transfer(body)
    if received:
        # This template only confirms the incoming-transfer case ("You've
        # received a transfer") -- direction is known for certain, no need
        # to guess it from the From/To lines.
        amount, currency, txn_date, txn_time = received
        direction = "credit"
    else:
        direction = common.detect_direction(from_line, to_line)
        dt_match = common.DATETIME_RE.search(body)
        dt_text = dt_match.group("datetime") if dt_match else None
        txn_date = common.resolve_txn_date(dt_text, email_date)
        txn_time = common.resolve_txn_time(dt_text, email_date)
        amount, currency = common.parse_amount(body)

    my_line = to_line if direction == "credit" else from_line
    counterparty_line = from_line if direction == "credit" else to_line

    return Transaction(
        bank="dbs",
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
        payment_method="paynow",
    )
