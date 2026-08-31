"""
Kasikornbank (Thailand) — K PLUS notifications.

Currently handles the "Result of Bill Payment (Success)" email (paying a
merchant/utility bill via K PLUS — always a debit). Kasikorn sends other
notification types from the same address (fund transfers, deposits, ATM
withdrawals, failed payments) — those fall through to log_unmatched()
until a sample is added here. Parsing is done against the English section
of the (Thai + English) body to avoid encoding/locale issues; dates in
this email type are Gregorian, not Buddhist Era.
"""
import re

from .base import Transaction, get_body_text

SENDER = "kasikornbank.com"

DATE_RE = re.compile(r"Transaction Date:\s*(?P<date>\d{2}/\d{2}/\d{4})")
AMOUNT_RE = re.compile(r"Amount\s*\(THB\):\s*(?P<amount>[\d,]+\.\d{2})")
COMPANY_RE = re.compile(r"Company Name:\s*(?P<company>.+)")
ACCOUNT_RE = re.compile(r"Paid From Account:\s*(?P<raw>\S+)")


def matches(msg) -> bool:
    sender_ok = SENDER in msg.get("From", "").lower()
    subject = msg.get("Subject", "").lower()
    return sender_ok and "bill payment" in subject and "success" in subject


def parse(msg) -> Transaction:
    subject = msg.get("Subject", "")
    body = get_body_text(msg)

    date_match = DATE_RE.search(body)
    amount_match = AMOUNT_RE.search(body)
    company_match = COMPANY_RE.search(body)
    account_match = ACCOUNT_RE.search(body)

    txn_date = msg.get("Date", "")
    if date_match:
        day, month, year = date_match.group("date").split("/")
        txn_date = f"{year}-{month}-{day}"

    account_mask = None
    if account_match:
        digits = re.search(r"\d{4}", account_match.group("raw"))
        account_mask = digits.group(0) if digits else None

    return Transaction(
        bank="kasikorn",
        account_mask=account_mask,
        txn_date=txn_date,
        amount=float(amount_match.group("amount").replace(",", "")) if amount_match else 0.0,
        currency="THB",
        direction="debit",
        merchant=company_match.group("company").strip().rstrip(".") if company_match else "Unknown",
        raw_subject=subject,
    )
