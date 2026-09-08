"""
Regression test for the actual bug: NETS Scan & Pay emails were silently
dropped because dbs.py's matches() required the literal string "paynow" in
the body. Fixture values are redacted (account mask 0000, txn_ref all
zeros) -- see finance-sync/tests/fixtures/dbs_nets_scan_pay.eml.
"""
import os
from email import message_from_file

from parsers import dbs

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(name):
    path = os.path.join(FIXTURES, name)
    with open(path, "r", encoding="utf-8") as f:
        msg = message_from_file(f)
    msg.gmail_id = "test-" + name
    return msg


def test_nets_scan_pay_plain_text():
    msg = _load("dbs_nets_scan_pay.eml")
    assert dbs.matches(msg) is True

    txn = dbs.parse(msg)
    assert txn["amount"] == 1.20
    assert txn["currency"] == "SGD"
    assert txn["direction"] == "debit"
    # Legal-suffix stripping ("PTE LTD" etc.) happens centrally in sync.py
    # (see test_categorize.py), not in the parser -- this asserts the raw
    # field the parser hands off.
    assert txn["merchant"] == "POKKA PTE LTD"
    assert txn["account_mask"] == "0000"
    assert txn["txn_date"] == "2026-08-31"
    assert txn["txn_time"] == "19:57"
    assert txn["txn_ref"] == "000000000000000"
    assert txn["status"] == "posted"
    assert txn["payment_method"] == "nets_qr"


def test_nets_scan_pay_html_fallback():
    """Same transaction, HTML-only body with &amp; entities and <b> tags --
    exercises base.py's get_body_text() HTML fallback path."""
    msg = _load("dbs_nets_scan_pay_html.eml")
    assert dbs.matches(msg) is True

    txn = dbs.parse(msg)
    assert txn["amount"] == 1.20
    assert txn["currency"] == "SGD"
    assert txn["direction"] == "debit"
    assert "POKKA" in txn["merchant"]
    assert txn["account_mask"] == "0000"
    assert txn["txn_ref"] == "000000000000000"
