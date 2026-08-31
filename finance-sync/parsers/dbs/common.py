"""
Shared regex helpers and dispatch data for DBS iBanking alert sub-parsers.
"""
import re
from datetime import timedelta

from dateutil import parser as dateparser

SENDER = "ibanking.alert@dbs.com"

DATETIME_RE = re.compile(r"Date\s*&\s*Time:\s*(?P<datetime>\d{1,2}\s+\w+\s+\d{1,2}:\d{2})")
# S$1.20 (NETS QR / digital) and SGD1.20 (transfer-style templates) both occur.
AMOUNT_RE = re.compile(r"Amount:\s*(?P<currency>[A-Z]{3}|S\$)\s*(?P<amount>[\d,]+\.\d{2})")
FROM_RE = re.compile(r"From:\s*(?P<party>.+)")
TO_RE = re.compile(r"To:\s*(?P<party>.+)")
TXN_REF_RE = re.compile(r"Transaction Ref:\s*(?P<ref>\S+)")
SUFFIX_RE = re.compile(r"\s+A/C\s+ending\s+\S+|\s*\(UEN\s+ending\s+\S+\)", re.IGNORECASE)
# "My side" of a From/To pair: either the literal "My Account" (PayNow-style
# templates) or "DBS/POSB Account ending NNNN" (NETS Scan & Pay). Do not rely
# on "My Account" alone -- it is not present in every template.
MY_ACCOUNT_LINE_RE = re.compile(r"(DBS/POSB Account ending|my account)", re.IGNORECASE)
MY_ACCOUNT_MASK_RE = re.compile(r"ending\s+(?P<mask>\d{3,6})")


def strip_suffix(line: str) -> str:
    return SUFFIX_RE.sub("", line or "").strip()


def normalize_currency(raw: str) -> str:
    return "SGD" if raw == "S$" else raw


def parse_amount(body: str) -> tuple[float, str]:
    match = AMOUNT_RE.search(body)
    if not match:
        return 0.0, "SGD"
    return float(match.group("amount").replace(",", "")), normalize_currency(match.group("currency"))


def detect_direction(from_line: str, to_line: str) -> str:
    """Which side is 'me' varies by template ('My Account' vs 'DBS/POSB
    Account ending NNNN'). If neither line resolves clearly, default to
    debit -- money leaving is the far more common alert and the safer
    assumption if this ever needs manual correction."""
    to_is_me = bool(MY_ACCOUNT_LINE_RE.search(to_line))
    from_is_me = bool(MY_ACCOUNT_LINE_RE.search(from_line))
    if to_is_me and not from_is_me:
        return "credit"
    return "debit"


def account_mask(line: str) -> str | None:
    match = MY_ACCOUNT_MASK_RE.search(line or "")
    return match.group("mask") if match else None


def resolve_txn_date(dt_text: str | None, email_date) -> str | None:
    """Parse a yearless 'DD Mon HH:MM' timestamp against the email's own
    Date header. If the parsed date lands more than a few days *after* the
    email arrived, the alert must be from the previous December, not the
    coming one -- dateutil's `default=` trick alone doesn't catch that."""
    if not dt_text or not email_date:
        return None
    try:
        parsed = dateparser.parse(dt_text, default=email_date)
    except (ValueError, TypeError, OverflowError):
        return None
    if parsed > email_date + timedelta(days=3):
        parsed = parsed.replace(year=parsed.year - 1)
    return parsed.date().isoformat()


def txn_ref(body: str) -> str | None:
    match = TXN_REF_RE.search(body)
    return match.group("ref") if match else None


def safe_email_date(msg):
    try:
        return dateparser.parse(msg.get("Date", ""))
    except (ValueError, TypeError, OverflowError):
        return None
