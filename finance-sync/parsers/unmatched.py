"""
Anything no parser claims lands here instead of being silently dropped —
so a bank changing its email format or a new bank needing a parser is
visible in the GitHub Actions run log, not a silent gap in your data.
"""
from email.message import Message


def log_unmatched(msg: Message) -> None:
    sender = msg.get("From", "unknown-sender")
    subject = msg.get("Subject", "unknown-subject")
    print(f"[unmatched] from={sender!r} subject={subject!r}")
