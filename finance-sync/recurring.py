"""
Materializes finance_recurring declarations into finance_transactions rows.

DBS never alerts on recurring transactions (subscriptions, utility/telco
bills, loan payments) at any threshold -- see README's "DBS alerting
rules". finance_recurring exists as a declared-not-captured concept: the
user tells the system what recurs and on which day, and this module
generates one finance_transactions row per declaration per month it's
due, marked is_estimated=True so the UI can show it's a guess, not a bank
confirmation. A real matching bank email, if one ever arrives, lands as a
separate row -- no cross-linking or dedup is attempted, since a recurring
declaration and a captured email share no identifier to match on.
"""
from datetime import date

EXTERNAL_ID_PREFIX = "recurring"


def recurring_external_id(recurring_id: str, month_key: str) -> str:
    return f"{EXTERNAL_ID_PREFIX}-{recurring_id}-{month_key}"


def due_this_month(rec: dict, today: date) -> bool:
    """A declaration is due once its day_of_month has been reached this
    month, and only from the month it started -- so it doesn't retroactively
    backfill months before the user declared it."""
    started = rec["started_on"]
    started = date.fromisoformat(started) if isinstance(started, str) else started
    if (today.year, today.month) < (started.year, started.month):
        return False
    return today.day >= rec["day_of_month"]


def build_recurring_row(rec: dict, month_key: str) -> dict:
    year, month = (int(x) for x in month_key.split("-"))
    return {
        "external_id": recurring_external_id(rec["id"], month_key),
        "bank": "recurring",
        "account": rec.get("account") or "DBS Main",
        "txn_date": date(year, month, rec["day_of_month"]).isoformat(),
        "amount": rec["amount"],
        "currency": rec.get("currency") or "SGD",
        "direction": rec.get("direction") or "debit",
        "merchant": rec["name"],
        "category": rec.get("category") or "bills",
        "raw_subject": None,
        "status": "posted",
        "payment_method": "recurring",
        "is_estimated": True,
    }


def pending_recurring_rows(declarations: list[dict], existing_external_ids: set[str], today: date) -> list[dict]:
    """Pure function: given active declarations, the set of external_ids
    already materialized, and today's date, return the rows that still
    need inserting this month. No I/O -- keeps this testable without a
    real Supabase client."""
    month_key = today.strftime("%Y-%m")
    rows = []
    for rec in declarations:
        if not rec.get("active", True):
            continue
        if not due_this_month(rec, today):
            continue
        ext_id = recurring_external_id(rec["id"], month_key)
        if ext_id in existing_external_ids:
            continue
        rows.append(build_recurring_row(rec, month_key))
    return rows


def materialize_recurring(supabase, user_id: str, dry_run: bool = False) -> list[dict]:
    """I/O wrapper: fetch active declarations and this month's already-
    materialized external_ids, compute what's newly due via
    pending_recurring_rows(), and insert (unless dry_run)."""
    decl_resp = (
        supabase.table("finance_recurring")
        .select("*")
        .eq("user_id", user_id)
        .eq("active", True)
        .execute()
    )
    declarations = decl_resp.data or []

    today = date.today()
    month_key = today.strftime("%Y-%m")
    existing_resp = (
        supabase.table("finance_transactions")
        .select("external_id")
        .eq("user_id", user_id)
        .like("external_id", f"{EXTERNAL_ID_PREFIX}-%-{month_key}")
        .execute()
    )
    existing_ids = {r["external_id"] for r in (existing_resp.data or [])}

    rows = pending_recurring_rows(declarations, existing_ids, today)
    for row in rows:
        row["user_id"] = user_id

    if rows and not dry_run:
        supabase.table("finance_transactions").insert(rows).execute()
    return rows
