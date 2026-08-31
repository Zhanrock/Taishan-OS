"""
DBS FAST transfer confirmations -- TODO: no confirmed sample yet.

Likely a variant of the PayNow/transfer template (see parsers/dbs/common.py
for the shared From:/To:/Amount: regex helpers) but the exact subject and
body have not been captured.

To wire this up: forward yourself a real "digibank Alert - ..." FAST
transfer email, redact it with redact_sample.py, paste the subject + body.
"""
from ..base import Transaction


def matches(msg) -> bool:
    return False


def parse(msg) -> Transaction:  # pragma: no cover - no confirmed template yet
    raise NotImplementedError("dbs.fast_transfer has no confirmed sample yet")
