"""
DBS PayLah! -- Scan & Pay Transfer confirmation.

Sent from paylah.alert@dbs.com -- a different sender to the main DBS
iBanking alerts (ibanking.alert@dbs.com) -- confirmed against a real email:
"We refer to your PayLah! Scan & Pay Transfer dated 06 Sep ... Amount:
SGD2.95 From: PayLah! Wallet (Mobile ending 0000) To: JAPAN HOME (RETAIL)".
PayLah! is a separate wallet balance from the linked DBS/POSB account it
tops up from, so these land tagged account="PayLah!", not "DBS Main" --
see README's Finance section.

Subject is the generic "Transaction Alerts" (no transaction-type hint, and
shared with other PayLah! templates), so this is claimed by body content,
not subject -- same reasoning as dbs/paynow.py.

Only the outgoing Scan & Pay template is confirmed; PayLah! top-ups, P2P
transfers ("PayLah! Alerts" also sends those) and any "received" template
are unconfirmed and fall through to dbs/__init__.py's NeedsReview until a
sample is added.
"""
import re

from ..base import Transaction, get_body_text
from . import common

BODY_RE = re.compile(r"PayLah!\s*Scan\s*&\s*Pay\s*Transfer", re.IGNORECASE)


def matches(msg) -> bool:
    return bool(BODY_RE.search(get_body_text(msg)))


def parse(msg) -> Transaction:
    subject = msg.get("Subject", "")
    body = get_body_text(msg)

    dt_match = common.DATETIME_RE.search(body)
    to_match = common.TO_RE.search(body)
    merchant_line = to_match.group("party").strip() if to_match else ""

    email_date = common.safe_email_date(msg)
    dt_text = dt_match.group("datetime") if dt_match else None
    txn_date = common.resolve_txn_date(dt_text, email_date)
    txn_time = common.resolve_txn_time(dt_text, email_date)
    amount, currency = common.parse_amount(body)

    return Transaction(
        bank="dbs",
        account="PayLah!",
        account_mask=common.account_mask(body),
        txn_date=txn_date or (email_date.date().isoformat() if email_date else ""),
        txn_time=txn_time,
        amount=amount,
        currency=currency,
        direction="debit",  # Scan & Pay always spends from the wallet -- no
                             # "received" template confirmed yet to guess from
        merchant=common.strip_suffix(merchant_line) or "Unknown",
        raw_subject=subject,
        txn_ref=common.txn_ref(body),
        status="posted",
        payment_method="paylah",
    )
