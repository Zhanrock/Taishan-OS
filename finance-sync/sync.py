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
import sys
from datetime import datetime, timezone
from email import message_from_bytes
from email.message import Message

from dateutil import parser as dateparser
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from supabase import create_client

from parsers import PARSERS
from parsers.unmatched import log_unmatched
from categorize import categorize

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


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


def sender_query() -> str:
    senders = [p.SENDER for p in PARSERS]
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

    gmail = gmail_client()
    messages = fetch_new_messages(gmail, since_iso)
    print(f"Fetched {len(messages)} candidate message(s) since {since_iso}")

    rows = []
    for msg in messages:
        parser = next((p for p in PARSERS if p.matches(msg)), None)
        if parser is None:
            log_unmatched(msg)
            continue
        txn = parser.parse(msg)
        txn["user_id"] = user_id
        txn["external_id"] = msg.gmail_id  # type: ignore[attr-defined]
        txn["category"] = categorize(txn.get("merchant", ""))
        rows.append(txn)

    if dry_run:
        for row in rows:
            print(row)
        print(f"[dry-run] {len(rows)} transaction(s) parsed, nothing written")
        return

    if rows:
        supabase.table("finance_transactions").upsert(
            rows, on_conflict="user_id,external_id"
        ).execute()

    supabase.table("finance_sync_state").upsert(
        {"user_id": user_id, "last_synced_at": datetime.now(timezone.utc).isoformat()},
        on_conflict="user_id",
    ).execute()
    print(f"Synced {len(rows)} transaction(s)")


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
