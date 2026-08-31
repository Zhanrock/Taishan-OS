"""
Verifies the PayNow parser still holds after the get_body_text() rewrite
and the dbs.py -> dbs/ package restructure. Fixture is a real confirmation
email with the account mask and UEN suffix redacted (0000) -- see
finance-sync/tests/fixtures/dbs_paynow.eml.

Notable: this email's real Subject is "iBanking Alerts" -- generic, not the
"digibank Alert - Successful <type>" convention NETS Scan & Pay uses. That
confirms paynow.py's decision to dispatch on body content ("paynow") rather
than subject, and means IGNORED_SUBJECT_PATTERNS' assumed convention is
unverified for non-transactional alert types until a real sample is seen
(see diagnose.py --list-subjects).
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


def test_paynow_confirmation():
    msg = _load("dbs_paynow.eml")
    assert msg["Subject"] == "iBanking Alerts"  # documents the generic-subject discovery
    assert dbs.matches(msg) is True

    txn = dbs.parse(msg)
    assert txn["amount"] == 7.50
    assert txn["currency"] == "SGD"
    assert txn["direction"] == "debit"
    assert txn["merchant"] == "FOMO PAY PTE. LTD."
    assert txn["account_mask"] == "0000"
    assert txn["txn_date"] == "2026-08-29"
    assert txn["txn_ref"] is None  # this template has no Transaction Ref line
    assert txn["status"] == "posted"
    assert txn["payment_method"] == "paynow"


def test_paynow_not_claimed_by_nets_scan_pay():
    """Guards the dispatch order: a generic-subject PayNow email must not
    accidentally fall through to NeedsReview or get misclassified."""
    msg = _load("dbs_paynow.eml")
    assert dbs.nets_scan_pay.matches(msg) is False
    assert dbs.paynow.matches(msg) is True
