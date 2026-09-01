"""
Covers the pure logic in recurring.py -- no Supabase client involved, since
materialize_recurring() is a thin I/O wrapper around these functions.
"""
from datetime import date

from recurring import build_recurring_row, due_this_month, pending_recurring_rows, recurring_external_id


def _rec(**overrides):
    base = {
        "id": "rec-1",
        "name": "Netflix",
        "amount": 15.98,
        "currency": "SGD",
        "direction": "debit",
        "category": "subscriptions",
        "day_of_month": 10,
        "active": True,
        "started_on": "2026-01-01",
    }
    base.update(overrides)
    return base


def test_recurring_external_id_is_stable_per_month():
    assert recurring_external_id("rec-1", "2026-09") == "recurring-rec-1-2026-09"


def test_due_this_month_before_the_day():
    assert due_this_month(_rec(day_of_month=10), date(2026, 9, 5)) is False


def test_due_this_month_on_or_after_the_day():
    assert due_this_month(_rec(day_of_month=10), date(2026, 9, 10)) is True
    assert due_this_month(_rec(day_of_month=10), date(2026, 9, 30)) is True


def test_due_this_month_before_start_month():
    assert due_this_month(_rec(started_on="2026-10-01", day_of_month=1), date(2026, 9, 15)) is False


def test_build_recurring_row_shape():
    row = build_recurring_row(_rec(), "2026-09")
    assert row["external_id"] == "recurring-rec-1-2026-09"
    assert row["txn_date"] == "2026-09-10"
    assert row["merchant"] == "Netflix"
    assert row["payment_method"] == "recurring"
    assert row["is_estimated"] is True
    assert row["status"] == "posted"


def test_pending_recurring_rows_skips_inactive():
    rows = pending_recurring_rows([_rec(active=False)], set(), date(2026, 9, 15))
    assert rows == []


def test_pending_recurring_rows_skips_already_materialized():
    ext_id = recurring_external_id("rec-1", "2026-09")
    rows = pending_recurring_rows([_rec()], {ext_id}, date(2026, 9, 15))
    assert rows == []


def test_pending_recurring_rows_returns_newly_due():
    rows = pending_recurring_rows([_rec()], set(), date(2026, 9, 15))
    assert len(rows) == 1
    assert rows[0]["external_id"] == "recurring-rec-1-2026-09"


def test_pending_recurring_rows_not_yet_due():
    rows = pending_recurring_rows([_rec(day_of_month=20)], set(), date(2026, 9, 15))
    assert rows == []
