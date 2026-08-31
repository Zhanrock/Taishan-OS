"""
DBS ATM withdrawal alerts -- TODO: no confirmed sample yet.

To wire this up: forward yourself a real "digibank Alert - ..." ATM
withdrawal email, redact it with redact_sample.py, paste the subject + body.
"""
from ..base import Transaction


def matches(msg) -> bool:
    return False


def parse(msg) -> Transaction:  # pragma: no cover - no confirmed template yet
    raise NotImplementedError("dbs.atm_withdrawal has no confirmed sample yet")
