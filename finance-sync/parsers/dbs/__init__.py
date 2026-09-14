"""
DBS Bank (Singapore) -- iBanking Alerts.

matches() claims ANY email from ibanking.alert@dbs.com. parse() first checks
IGNORED_SUBJECT_PATTERNS (non-transactional alerts -- GIRO/standing
instruction set-up, card activation/replacement, password/PIN changes,
personal particulars updates, login/device alerts, notification-preference
changes, statement-ready notices, marketing) and raises Ignored for those,
so a widened Gmail query doesn't flood finance_unmatched with noise. Then it
dispatches to a sub-parser by subject (or, for paynow, by body -- see
paynow.py). If nothing matches, raises NeedsReview so sync.py logs it to
finance_unmatched instead of guessing or silently dropping it.

Live sub-parsers: nets_scan_pay, paynow, card, paylah.
Scaffolded (TODO, no confirmed sample yet): giro, fast_transfer,
atm_withdrawal, salary_credit.

PayLah! alerts come from a separate sender (paylah.alert@dbs.com, not
ibanking.alert@dbs.com) and dispatch through their own sub-parser list --
see PAYLAH_SENDER below and parsers/dbs/paylah.py's docstring for why it's
kept a distinct account despite living under the same "dbs" bank umbrella.

DBS does NOT use one uniform subject convention -- confirmed from two real
samples: NETS Scan & Pay's subject is "digibank Alert - Successful NETS
Scan & Pay" (descriptive), but PayNow's is the generic "iBanking Alerts"
(no transaction-type info at all). IGNORED_SUBJECT_PATTERNS below assumes
the "digibank Alert - <description>" shape for non-transactional alerts;
that is unverified and may simply not match some of them, in which case
they'll surface in finance_unmatched instead of being silently ignored
(the safe failure mode) rather than being wrongly ignored. Grow/correct
this list from real inbox data with:
  python diagnose.py --list-subjects
"""
import re

from ..base import Ignored, NeedsReview, Transaction
from . import atm_withdrawal, card, common, fast_transfer, giro, nets_scan_pay, paylah, paynow, salary_credit

SENDER = common.SENDER
PAYLAH_SENDER = "paylah.alert@dbs.com"
SENDERS = [SENDER, PAYLAH_SENDER]

SUB_PARSERS = [nets_scan_pay, paynow, card, giro, fast_transfer, atm_withdrawal, salary_credit]
PAYLAH_SUB_PARSERS = [paylah]

# DBS's subject convention is "digibank Alert - <description>". Match on the
# descriptive part, not an assumed "Successful" prefix -- non-transactional
# notices don't use that word. Seed/grow this list from real data via
# `python diagnose.py --list-subjects` rather than guessing further entries.
IGNORED_SUBJECT_PATTERNS = [
    re.compile(r"GIRO.*(Set[- ]?up|Registration|Arrangement)", re.IGNORECASE),
    re.compile(r"Standing Instruction.*(Set[- ]?up|Registration)", re.IGNORECASE),
    re.compile(r"Card.*(Activat|Replac|Block|Suspend)", re.IGNORECASE),
    re.compile(r"Password.*Chang", re.IGNORECASE),
    re.compile(r"\bPIN\b.*Chang", re.IGNORECASE),
    re.compile(r"Personal Particulars", re.IGNORECASE),
    re.compile(r"(Login|Device).*(Alert|Registration)", re.IGNORECASE),
    re.compile(r"Notification Preference", re.IGNORECASE),
    re.compile(r"Statement.*Ready", re.IGNORECASE),
    re.compile(r"e-Statement", re.IGNORECASE),
    re.compile(r"\bOTP\b", re.IGNORECASE),  # confirmed real: "digibank Alert - Email OTP"
]


def matches(msg) -> bool:
    sender = msg.get("From", "").lower()
    return any(s in sender for s in SENDERS)


def _is_ignored(subject: str) -> bool:
    return any(pattern.search(subject) for pattern in IGNORED_SUBJECT_PATTERNS)


def parse(msg) -> Transaction:
    subject = msg.get("Subject", "")
    sender = msg.get("From", "").lower()

    if PAYLAH_SENDER in sender:
        for sub_parser in PAYLAH_SUB_PARSERS:
            if sub_parser.matches(msg):
                return sub_parser.parse(msg)
        raise NeedsReview(f"no PayLah sub-parser matched subject: {subject!r}")

    if _is_ignored(subject):
        raise Ignored(subject)
    for sub_parser in SUB_PARSERS:
        if sub_parser.matches(msg):
            return sub_parser.parse(msg)
    raise NeedsReview(f"no DBS sub-parser matched subject: {subject!r}")
