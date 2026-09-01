"""
Covers the pure logic in sync.py -- no Supabase/Gmail client involved.
"""
from sync import filter_new_rows


def test_filter_new_rows_drops_already_synced_external_id():
    rows = [{"external_id": "abc", "merchant": "MCDONALD'S"}]
    assert filter_new_rows(rows, {"abc"}) == []


def test_filter_new_rows_keeps_genuinely_new_rows():
    rows = [{"external_id": "abc", "merchant": "MCDONALD'S"}]
    assert filter_new_rows(rows, set()) == rows


def test_filter_new_rows_mixed_batch():
    rows = [
        {"external_id": "new-1", "merchant": "A"},
        {"external_id": "old-1", "merchant": "B"},
        {"external_id": "new-2", "merchant": "C"},
    ]
    result = filter_new_rows(rows, {"old-1"})
    assert [r["external_id"] for r in result] == ["new-1", "new-2"]
