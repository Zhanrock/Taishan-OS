"""
Redact a raw .eml sample before it can be turned into a committable test
fixture.

  python redact_sample.py path/to/raw.eml path/to/fixtures/output.eml

Masks account-ending digits, transaction refs, UEN-shaped numbers, and any
other long digit run. This is a floor, not a guarantee -- it does NOT catch
names or merchant strings, since those can't be told apart from legitimate
text automatically. Review the output by hand before committing it. Never
commit an unredacted bank email -- see finance-sync/README.md.
"""
import re
import sys

ACCOUNT_MASK_RE = re.compile(r"(ending\s+)(\d{3,6})", re.IGNORECASE)
TXN_REF_RE = re.compile(r"(Transaction Ref:\s*)(\S+)")
UEN_RE = re.compile(r"\b\d{8,10}[A-Z]\b")
LONG_DIGIT_RUN_RE = re.compile(r"\b\d{10,}\b")


def redact(text: str) -> str:
    text = ACCOUNT_MASK_RE.sub(r"\g<1>0000", text)
    text = TXN_REF_RE.sub(lambda m: m.group(1) + "0" * len(m.group(2)), text)
    text = UEN_RE.sub("00000000X", text)
    text = LONG_DIGIT_RUN_RE.sub(lambda m: "0" * len(m.group(0)), text)
    return text


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: python redact_sample.py <input.eml> <output.eml>")
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, "r", encoding="utf-8", errors="ignore") as f:
        raw = f.read()
    with open(dst, "w", encoding="utf-8") as f:
        f.write(redact(raw))
    print(f"Wrote redacted copy to {dst}.")
    print("Review it by hand before committing -- this catches account numbers/refs, not names or merchant strings.")


if __name__ == "__main__":
    main()
