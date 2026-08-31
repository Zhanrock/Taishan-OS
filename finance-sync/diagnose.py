"""
Finance-sync diagnostics.

  python diagnose.py --list-subjects [--sender ibanking.alert@dbs.com] [--days 90]
    Prints distinct email subjects seen from a sender over the last N days,
    with counts. Use this to grow parsers/dbs's IGNORED_SUBJECT_PATTERNS and
    sub-parser coverage from real inbox data instead of guessing.

Requires the same Gmail environment variables as sync.py (does not touch
Supabase, and never writes anything).
"""
import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone

from sync import gmail_client


def list_subjects(sender: str, days: int) -> None:
    gmail = gmail_client()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y/%m/%d")
    query = f"from:{sender} after:{since}"
    counts: Counter[str] = Counter()
    page_token = None
    while True:
        resp = gmail.users().messages().list(userId="me", q=query, pageToken=page_token).execute()
        for item in resp.get("messages", []):
            meta = gmail.users().messages().get(
                userId="me", id=item["id"], format="metadata", metadataHeaders=["Subject"]
            ).execute()
            headers = {h["name"]: h["value"] for h in meta.get("payload", {}).get("headers", [])}
            counts[headers.get("Subject", "(no subject)")] += 1
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    total = sum(counts.values())
    print(f"{total} message(s) from {sender} in the last {days} days, {len(counts)} distinct subject(s):\n")
    for subject, count in counts.most_common():
        print(f"{count:4d}  {subject}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--list-subjects", action="store_true",
                         help="list distinct subjects seen from --sender in the last --days days")
    parser.add_argument("--sender", default="ibanking.alert@dbs.com")
    parser.add_argument("--days", type=int, default=90)
    args = parser.parse_args()

    if args.list_subjects:
        list_subjects(args.sender, args.days)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
