"""
Finance sync entrypoint.

Pulls new bank transaction/notification emails from Gmail, runs them through
the parser registry in parsers/, categorizes them, and upserts the results
into Supabase (finance_transactions), then advances finance_sync_state.

Run modes:
  python sync.py            # live: writes to Supabase
  python sync.py --dry-run  # prints parsed transactions, writes nothing

Required environment variables (see .env.example):
  GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  FINANCE_USER_ID   -- the Supabase auth.users.id these rows belong to
"""
import base64
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from email import message_from_bytes
from email.message import Message

from dateutil import parser as dateparser
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from supabase import create_client

from parsers import PARSERS
from parsers.base import Ignored, NeedsReview, get_body_text
from categorize import categorize, strip_legal_suffix
from recurring import materialize_recurring

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
SYNC_OVERLAP = timedelta(days=2)


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def gmail_client():
    creds = Credentials(
        token=None,
        refresh_token=env("GMAIL_REFRESH_TOKEN"),
        client_id=env("GMAIL_CLIENT_ID"),
        client_secret=env("GMAIL_CLIENT_SECRET"),
        token_uri="https://oauth2.googleapis.com/token",
        scopes=GMAIL_SCOPES,
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def parser_senders(parser) -> list[str]:
    return list(getattr(parser, "SENDERS", None) or [parser.SENDER])


def sender_query() -> str:
    senders = [s for p in PARSERS for s in parser_senders(p)]
    return " OR ".join(f"from:{s}" for s in senders)


def fetch_new_messages(gmail, since_iso: str) -> list[Message]:
    since_date = dateparser.isoparse(since_iso).strftime("%Y/%m/%d")
    query = f"({sender_query()}) after:{since_date}"
    messages: list[Message] = []
    page_token = None
    while True:
        resp = gmail.users().messages().list(
            userId="me", q=query, pageToken=page_token
        ).execute()
        for item in resp.get("messages", []):
            raw = gmail.users().messages().get(
                userId="me", id=item["id"], format="raw"
            ).execute()
            msg_bytes = base64.urlsafe_b64decode(raw["raw"])
            parsed = message_from_bytes(msg_bytes)
            parsed.gmail_id = item["id"]  # type: ignore[attr-defined]
            messages.append(parsed)
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return messages


def _safe_parse_date(value: str) -> datetime | None:
    try:
        parsed = dateparser.parse(value)
    except (ValueError, TypeError, OverflowError):
        return None
    if parsed is None:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def next_sync_window(since_iso: str, messages: list[Message]) -> tuple[str, datetime | None]:
    """The next last_synced_at: newest fetched message's own Date header,
    minus a 2-day overlap buffer so a next run re-checks the last couple of
    days rather than trusting a hard cutoff. Never advances past `now`, and
    never moves backwards if no messages were seen this run."""
    dates = [d for d in (_safe_parse_date(m.get("Date", "")) for m in messages) if d]
    if not dates:
        return since_iso, None
    newest = max(dates)
    new_since = min(newest, datetime.now(timezone.utc)) - SYNC_OVERLAP
    return new_since.isoformat(), newest


def build_unmatched_row(user_id: str, msg: Message, reason: str = "") -> dict:
    received_at = _safe_parse_date(msg.get("Date", ""))
    body = get_body_text(msg)
    return {
        "user_id": user_id,
        "gmail_id": msg.gmail_id,  # type: ignore[attr-defined]
        "sender": msg.get("From", ""),
        "subject": msg.get("Subject", ""),
        "received_at": received_at.isoformat() if received_at else None,
        "snippet": body[:280],
        "reason": reason,
        "resolved": False,
    }


def _normalize_merchant(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (name or "").upper())


def dedup_and_merge(supabase, user_id: str, rows: list[dict]) -> list[dict]:
    """Catch a purchase that emails both an authorisation and a settlement
    (or any other double-send) before it becomes two rows. Dedup on txn_ref
    first -- DBS's own stable id. Where absent, soft-match on
    (amount, currency, merchant, txn_date +/- 3 days). A match updates the
    existing row's status/txn_ref instead of inserting a duplicate. Returns
    the rows that still need inserting."""
    to_insert = []
    for row in rows:
        existing = None
        if row.get("txn_ref"):
            resp = (
                supabase.table("finance_transactions")
                .select("id, external_id, status")
                .eq("user_id", user_id)
                .eq("txn_ref", row["txn_ref"])
                .execute()
            )
            existing = next((r for r in resp.data if r["external_id"] != row["external_id"]), None)

        if not existing and row.get("txn_date"):
            txn_date = date.fromisoformat(row["txn_date"])
            window_start = (txn_date - timedelta(days=3)).isoformat()
            window_end = (txn_date + timedelta(days=3)).isoformat()
            resp = (
                supabase.table("finance_transactions")
                .select("id, external_id, status, merchant")
                .eq("user_id", user_id)
                .eq("amount", row["amount"])
                .eq("currency", row["currency"])
                .gte("txn_date", window_start)
                .lte("txn_date", window_end)
                .execute()
            )
            candidates = [
                r for r in resp.data
                if r["external_id"] != row["external_id"]
                and _normalize_merchant(r.get("merchant", "")) == _normalize_merchant(row.get("merchant", ""))
            ]
            existing = candidates[0] if candidates else None

        if existing:
            print(f"[soft-merge] {row.get('merchant')} {row.get('amount')} {row.get('currency')} "
                  f"-> existing row {existing['id']} (was {existing.get('status')}, now {row.get('status')})")
            supabase.table("finance_transactions").update({
                "status": row.get("status", "posted"),
                "txn_ref": row.get("txn_ref") or None,
            }).eq("id", existing["id"]).execute()
            continue
        to_insert.append(row)
    return to_insert


def run(dry_run: bool) -> None:
    user_id = env("FINANCE_USER_ID")
    supabase = create_client(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))

    state = (
        supabase.table("finance_sync_state")
        .select("last_synced_at")
        .eq("user_id", user_id)
        .execute()
    )
    since_iso = (
        state.data[0]["last_synced_at"]
        if state.data
        else "2020-01-01T00:00:00Z"
    )

    recurring_rows = materialize_recurring(supabase, user_id, dry_run=dry_run)
    if recurring_rows:
        prefix = "[dry-run] would materialize" if dry_run else "Materialized"
        print(f"{prefix} {len(recurring_rows)} recurring transaction(s): "
              + ", ".join(f"{r['merchant']} ({r['amount']} {r['currency']})" for r in recurring_rows))

    gmail = gmail_client()
    messages = fetch_new_messages(gmail, since_iso)
    print(f"Fetched {len(messages)} candidate message(s) since {since_iso}")

    rows = []
    unmatched_rows = []
    ignored_count = 0

    for msg in messages:
        parser = next((p for p in PARSERS if p.matches(msg)), None)
        if parser is None:
            unmatched_rows.append(build_unmatched_row(user_id, msg, reason="no parser claimed sender"))
            continue
        try:
            txn = parser.parse(msg)
        except Ignored:
            ignored_count += 1
            continue
        except NeedsReview as e:
            unmatched_rows.append(build_unmatched_row(user_id, msg, reason=str(e) or "unrecognised subject/body"))
            continue
        txn["user_id"] = user_id
        txn["external_id"] = msg.gmail_id  # type: ignore[attr-defined]
        txn["merchant"] = strip_legal_suffix(txn.get("merchant", "")) or txn.get("merchant") or "Unknown"
        txn["category"] = categorize(txn["merchant"])
        rows.append(txn)

    new_since_iso, newest_seen = next_sync_window(since_iso, messages)
    window_note = f"newest message {newest_seen.isoformat()}" if newest_seen else "no messages this run"
    print(f"Sync window: {since_iso} -> {new_since_iso} ({window_note}, {SYNC_OVERLAP.days}-day overlap buffer)")
    print(f"Parsed {len(rows)} transaction(s), ignored {ignored_count} non-transactional alert(s), "
          f"{len(unmatched_rows)} unmatched/needs-review")

    if dry_run:
        for row in rows:
            print(row)
        for row in unmatched_rows:
            print(f"[unmatched] {row}")
        print(f"[dry-run] {len(rows)} transaction(s) parsed, nothing written")
        return

    if rows:
        rows = dedup_and_merge(supabase, user_id, rows)

    if rows:
        supabase.table("finance_transactions").upsert(
            rows, on_conflict="user_id,external_id"
        ).execute()

    if unmatched_rows:
        supabase.table("finance_unmatched").upsert(
            unmatched_rows, on_conflict="user_id,gmail_id"
        ).execute()

    supabase.table("finance_sync_state").upsert(
        {
            "user_id": user_id,
            "last_synced_at": new_since_iso,
            "last_run_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id",
    ).execute()
    print(f"Synced {len(rows)} transaction(s)")


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
