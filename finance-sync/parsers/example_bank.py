"""
TEMPLATE PARSER — replace with your first real bank once you send a sample.

This is not wired to any real bank yet. It exists to show the pattern:
  - SENDER: the exact notification address Gmail search filters on
  - matches(): cheap check (usually just the sender is enough, since SENDER
    already scopes the Gmail query — matches() lets you also filter by
    subject if one sender sends multiple email types)
  - parse(): pulls the fields out of the subject/body with regex

To add a real bank:
  1. Copy this file to parsers/<bank_name>.py
  2. Set SENDER to the real notification address
  3. Replace the regexes below with ones that match a real sample email
  4. Register it in parsers/__init__.py
"""
import re

from .base import Transaction, get_body_text

SENDER = "notifications@example-bank.invalid"

# Matches things like: "You spent THB 129.00 at 7-Eleven on 24 Aug"
AMOUNT_RE = re.compile(r"(?P<currency>[A-Z]{3})\s?(?P<amount>[\d,]+\.\d{2})")
MERCHANT_RE = re.compile(r"\bat\s+(?P<merchant>.+?)\s+on\b")
DATE_RE = re.compile(r"\bon\s+(?P<date>\d{1,2}\s+\w+)")
ACCOUNT_RE = re.compile(r"a/c.*?(?P<mask>\d{4})\b", re.IGNORECASE)


def matches(msg) -> bool:
    return msg.get("From", "").lower().find(SENDER) != -1


def parse(msg) -> Transaction:
    subject = msg.get("Subject", "")
    body = get_body_text(msg)
    text = f"{subject}\n{body}"

    amount_match = AMOUNT_RE.search(text)
    merchant_match = MERCHANT_RE.search(text)
    account_match = ACCOUNT_RE.search(text)

    return Transaction(
        bank="example_bank",
        account_mask=account_match.group("mask") if account_match else None,
        txn_date=msg.get("Date", ""),  # sync.py's caller should normalize this
        amount=float(amount_match.group("amount").replace(",", "")) if amount_match else 0.0,
        currency=amount_match.group("currency") if amount_match else "THB",
        direction="debit",
        merchant=merchant_match.group("merchant") if merchant_match else "Unknown",
        raw_subject=subject,
    )
