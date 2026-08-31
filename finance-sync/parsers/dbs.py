"""
DBS Bank (Singapore) — iBanking Alerts.

Currently handles PayNow transaction confirmations. DBS sends other
notification types (card transactions, GIRO, FAST transfers, etc.) from the
same address — those fall through to log_unmatched() until a sample is
added here.
"""
import re

from dateutil import parser as dateparser

from .base import Transaction, get_body_text

SENDER = "ibanking.alert@dbs.com"

DATETIME_RE = re.compile(r"Date\s*&\s*Time:\s*(?P<datetime>\d{1,2}\s+\w+\s+\d{1,2}:\d{2})")
AMOUNT_RE = re.compile(r"Amount:\s*(?P<currency>[A-Z]{3})(?P<amount>[\d,]+\.\d{2})")
FROM_RE = re.compile(r"From:\s*(?P<party>.+)")
TO_RE = re.compile(r"To:\s*(?P<party>.+)")
SUFFIX_RE = re.compile(r"\s+A/C\s+ending\s+\S+|\s*\(UEN\s+ending\s+\S+\)", re.IGNORECASE)
MY_ACCOUNT_MASK_RE = re.compile(r"ending\s+(?P<mask>\d{3,6})")


def matches(msg) -> bool:
    return SENDER in msg.get("From", "").lower() and "paynow" in get_body_text(msg).lower()


def _strip_suffix(line: str) -> str:
    return SUFFIX_RE.sub("", line).strip()


def parse(msg) -> Transaction:
    subject = msg.get("Subject", "")
    body = get_body_text(msg)

    dt_match = DATETIME_RE.search(body)
    amount_match = AMOUNT_RE.search(body)
    from_match = FROM_RE.search(body)
    to_match = TO_RE.search(body)

    from_line = from_match.group("party").strip() if from_match else ""
    to_line = to_match.group("party").strip() if to_match else ""
    is_incoming = "my account" in to_line.lower()

    my_account_line = to_line if is_incoming else from_line
    counterparty_line = from_line if is_incoming else to_line

    mask_match = MY_ACCOUNT_MASK_RE.search(my_account_line)
    account_mask = mask_match.group("mask") if mask_match else None
    merchant = _strip_suffix(counterparty_line) or "Unknown"

    txn_date = msg.get("Date", "")
    if dt_match:
        try:
            email_date = dateparser.parse(msg.get("Date", ""))
            txn_date = dateparser.parse(dt_match.group("datetime"), default=email_date).date().isoformat()
        except (ValueError, TypeError):
            pass

    return Transaction(
        bank="dbs",
        account_mask=account_mask,
        txn_date=txn_date,
        amount=float(amount_match.group("amount").replace(",", "")) if amount_match else 0.0,
        currency=amount_match.group("currency") if amount_match else "SGD",
        direction="credit" if is_incoming else "debit",
        merchant=merchant,
        raw_subject=subject,
    )
