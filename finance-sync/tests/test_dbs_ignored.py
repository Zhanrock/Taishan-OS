"""Regression coverage for IGNORED_SUBJECT_PATTERNS -- entries confirmed
real (via finance_unmatched, seen against a live inbox) should stay
ignored; nothing here should be guessed without a real subject behind it."""
from parsers import dbs


def test_email_otp_is_ignored():
    # Confirmed real via a live sync run: "digibank Alert - Email OTP"
    # landed in finance_unmatched before this pattern was added.
    assert dbs._is_ignored("digibank Alert - Email OTP") is True


def test_transactional_subjects_are_not_ignored():
    assert dbs._is_ignored("digibank Alert - Successful NETS Scan & Pay") is False
    assert dbs._is_ignored("iBanking Alerts") is False
