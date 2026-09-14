"""
Regression test for parsers/dbs/paylah.py, confirmed against a real
"Transaction Alerts" email from paylah.alert@dbs.com (SGD2.95 Scan & Pay
at JAPAN HOME (RETAIL), mobile ending 0000). Fixture values are redacted
(mobile mask 0000, txn_ref zeroed) -- see
finance-sync/tests/fixtures/dbs_paylah.eml.
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


def test_paylah_scan_and_pay_transfer():
    msg = _load("dbs_paylah.eml")
    assert dbs.matches(msg) is True

    txn = dbs.parse(msg)
    assert txn["bank"] == "dbs"
    assert txn["account"] == "PayLah!"
    assert txn["amount"] == 2.95
    assert txn["currency"] == "SGD"
    assert txn["direction"] == "debit"
    assert txn["merchant"] == "JAPAN HOME (RETAIL)"
    assert txn["account_mask"] == "0000"
    assert txn["txn_date"] == "2026-09-06"
    assert txn["txn_time"] == "20:37"
    assert txn["txn_ref"] == "PLPE0000000000000000"
    assert txn["status"] == "posted"
    assert txn["payment_method"] == "paylah"
