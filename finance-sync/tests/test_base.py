from email.message import EmailMessage

from parsers.base import get_body_text


def test_prefers_plain_text_part_when_both_present():
    msg = EmailMessage()
    msg["Subject"] = "test"
    msg.set_content("From: My Account\nTo: Someone")
    msg.add_alternative("<p>From: <b>Wrong</b></p>", subtype="html")
    assert "From: My Account" in get_body_text(msg)


def test_html_fallback_unescapes_entities_and_keeps_line_breaks():
    msg = EmailMessage()
    msg["Subject"] = "test"
    msg.add_attachment(
        b"<p><b>Date &amp; Time:</b> 31 Aug 19:57 SGT</p><p><b>Amount:</b> S$1.20</p>",
        maintype="text",
        subtype="html",
    )
    body = get_body_text(msg)
    assert "Date & Time: 31 Aug 19:57 SGT" in body
    assert "Amount: S$1.20" in body
    # Two separate lines, not one run-on string -- From:/To:/Amount: regexes
    # depend on this.
    lines = [l for l in body.splitlines() if l]
    assert len(lines) == 2
