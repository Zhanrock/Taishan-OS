"""
Shared shape for bank email parsers.

Each bank module (e.g. example_bank.py) exposes:
  SENDER          -- the notification email address to filter Gmail by
                     (or SENDERS -- a list, if the bank uses more than one)
  matches(msg)     -- True if this parser should handle the given email.Message
  parse(msg)       -- returns a dict with the finance_transactions fields this
                       parser can fill in (everything except user_id, external_id,
                       category, which sync.py fills in). May instead raise
                       Ignored (real match, not a transaction, skip silently)
                       or NeedsReview (claimed but couldn't be classified --
                       logged to finance_unmatched).

Expected parse() return shape (all keys required except account_mask and
txn_time):
{
  "bank": "example_bank",
  "account_mask": "1234",       # last 4 digits, or None if not present
  "txn_date": "2026-08-24",     # ISO date string
  "txn_time": "14:32",          # "HH:MM" 24h, or None if the body has no time
  "amount": 129.00,
  "currency": "THB",
  "direction": "debit",         # "debit" | "credit"
  "merchant": "7-Eleven",
  "raw_subject": "You spent THB 129.00 at 7-Eleven",
}
"""
import re
from email.message import Message
from html import unescape
from typing import Protocol, TypedDict

from bs4 import BeautifulSoup


class Transaction(TypedDict, total=False):
    bank: str
    account_mask: str | None
    txn_date: str
    txn_time: str | None
    amount: float
    currency: str
    direction: str
    merchant: str
    raw_subject: str
    txn_ref: str | None
    status: str
    payment_method: str


class BankParser(Protocol):
    SENDER: str

    def matches(self, msg: Message) -> bool: ...
    def parse(self, msg: Message) -> Transaction: ...


class Ignored(Exception):
    """Raise from parse() when the email genuinely came from this bank but is
    not a transaction (account alerts, marketing, preference confirmations,
    etc). sync.py counts these and moves on -- they are correctly ignored,
    not unread, so they must NOT land in finance_unmatched."""


class NeedsReview(Exception):
    """Raise from parse() when the email came from this bank but no
    sub-parser recognised it. sync.py logs these to finance_unmatched so a
    human can add coverage, instead of silently dropping or guessing."""

    def __init__(self, reason: str = ""):
        super().__init__(reason)
        self.reason = reason


_BLOCK_TAGS = ("br", "p", "div", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6")


def _html_to_text(html: str) -> str:
    """Convert an HTML email body to text, preserving line breaks -- the
    From:/To:/Amount: regexes rely on `.+` and expect one field per line,
    which plain tag-stripping destroys."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(_BLOCK_TAGS):
        tag.insert_before("\n")
    text = unescape(soup.get_text())
    lines = (re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines())
    return "\n".join(line for line in lines if line)


def get_body_text(msg: Message) -> str:
    """Walk a MIME message and return the best-effort text body. Prefers
    text/plain; falls back to text/html (converted to text) only if no
    plain part exists, since HTML entities and tags otherwise break every
    downstream regex silently."""
    if not msg.is_multipart():
        payload = msg.get_payload(decode=True)
        if not payload:
            return ""
        text = payload.decode(msg.get_content_charset() or "utf-8", "ignore")
        return _html_to_text(text) if msg.get_content_type() == "text/html" else text

    html_fallback = None
    for part in msg.walk():
        content_type = part.get_content_type()
        if content_type not in ("text/plain", "text/html"):
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        text = payload.decode(part.get_content_charset() or "utf-8", "ignore")
        if content_type == "text/plain":
            return text
        if html_fallback is None:
            html_fallback = text
    return _html_to_text(html_fallback) if html_fallback else ""
