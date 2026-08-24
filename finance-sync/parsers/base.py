"""
Shared shape for bank email parsers.

Each bank module (e.g. example_bank.py) exposes:
  SENDER          -- the notification email address to filter Gmail by
  matches(msg)     -- True if this parser should handle the given email.Message
  parse(msg)       -- returns a dict with the finance_transactions fields this
                       parser can fill in (everything except user_id, external_id,
                       category, which sync.py fills in)

Expected parse() return shape (all keys required except account_mask):
{
  "bank": "example_bank",
  "account_mask": "1234",       # last 4 digits, or None if not present
  "txn_date": "2026-08-24",     # ISO date string
  "amount": 129.00,
  "currency": "THB",
  "direction": "debit",         # "debit" | "credit"
  "merchant": "7-Eleven",
  "raw_subject": "You spent THB 129.00 at 7-Eleven",
}
"""
from email.message import Message
from typing import Protocol, TypedDict


class Transaction(TypedDict, total=False):
    bank: str
    account_mask: str | None
    txn_date: str
    amount: float
    currency: str
    direction: str
    merchant: str
    raw_subject: str


class BankParser(Protocol):
    SENDER: str

    def matches(self, msg: Message) -> bool: ...
    def parse(self, msg: Message) -> Transaction: ...


def get_body_text(msg: Message) -> str:
    """Walk a MIME message and return the best-effort plain/HTML text body."""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() in ("text/plain", "text/html"):
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode(part.get_content_charset() or "utf-8", "ignore")
        return ""
    payload = msg.get_payload(decode=True)
    if not payload:
        return ""
    return payload.decode(msg.get_content_charset() or "utf-8", "ignore")
