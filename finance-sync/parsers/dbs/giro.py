"""
DBS GIRO / standing instruction payments -- TODO: no confirmed sample yet.

Note: DBS also sends GIRO/standing-instruction *set-up* confirmations
(non-transactional) from the same sender -- those belong in
parsers/dbs/__init__.py's IGNORED_SUBJECT_PATTERNS, not here. This file is
for the recurring debit itself, if DBS ever emails one (recurring
transactions are excluded from alerting by design, so this may end up
permanently unreachable -- confirm with a real sample before assuming
otherwise).

To wire this up: forward yourself a real "digibank Alert - ..." GIRO
payment email, redact it with redact_sample.py, paste the subject + body.
"""
from ..base import Transaction


def matches(msg) -> bool:
    return False


def parse(msg) -> Transaction:  # pragma: no cover - no confirmed template yet
    raise NotImplementedError("dbs.giro has no confirmed sample yet")
