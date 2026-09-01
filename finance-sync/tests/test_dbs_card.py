"""
Regression test for parsers/dbs/card.py, confirmed against a real "Card
Transaction Alert" email (SGD5.00 at MCDONALD'S (NTU), card ending 0000 --
a Google Wallet transaction, which uses this same template). Fixture
values are redacted (account mask 0000, txn_ref all zeros) -- see
finance-sync/tests/fixtures/dbs_card.eml.
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


def test_card_transaction_alert():
    msg = _load("dbs_card.eml")
    assert dbs.matches(msg) is True

    txn = dbs.parse(msg)
    assert txn["amount"] == 5.00
    assert txn["currency"] == "SGD"
    assert txn["direction"] == "debit"
    assert txn["merchant"] == "MCDONALD'S (NTU)"
    assert txn["account_mask"] == "0000"
    assert txn["txn_date"] == "2026-09-01"
    assert txn["txn_ref"] == "000000000000"
    assert txn["status"] == "posted"
    assert txn["payment_method"] == "card"
