# finance-sync

Pulls bank transaction/notification emails from Gmail on a schedule, parses
them per-bank, auto-categorizes them, and upserts the results into Supabase
(`finance_transactions`). Runs via the `finance-sync.yml` GitHub Actions
workflow every 6 hours, or manually with the "Run workflow" button. A `test`
job runs `pytest` before every sync (scheduled or manual) and blocks the
sync if tests fail.

## Supported banks

| Bank | Notification type | Status |
|------|-------------------|--------|
| DBS (Singapore) | PayNow transfer confirmations (`parsers/dbs/paynow.py`) | Live, tested against a real sample |
| DBS (Singapore) | NETS Scan & Pay (`parsers/dbs/nets_scan_pay.py`) | Live |
| DBS (Singapore) | Card (Visa/Mastercard/NETS card, contactless, Google Wallet) -- `parsers/dbs/card.py` | Live, tested against a real sample |
| DBS PayLah! (Singapore) | Scan & Pay Transfer -- `parsers/dbs/paylah.py`, sent from a separate `paylah.alert@dbs.com` sender, tagged `account="PayLah!"` | Live, tested against a real sample. Top-ups/P2P transfers unconfirmed |
| DBS (Singapore) | GIRO / standing instruction | Scaffolded |
| DBS (Singapore) | FAST transfer | Scaffolded |
| DBS (Singapore) | ATM withdrawal | Scaffolded |
| DBS (Singapore) | Salary / incoming credit | Scaffolded |
| Kasikornbank (Thailand) | K PLUS "Result of Bill Payment (Success)" (`parsers/kasikorn.py`) | Live, debit only |

DBS was previously described as PayNow-only -- that was true until NETS
Scan & Pay was added; it is not a complete picture of every alert DBS sends
(see "Known coverage gaps" below).

Anything from a supported bank's sender that no sub-parser recognises is
persisted to `finance_unmatched` (not silently dropped) so it's visible
without digging through Actions logs -- see "Reading the unmatched list."

## Accounts vs. banks

`finance_transactions.account` is a separate concept from `bank`: `bank`
identifies the institution/parser (`dbs`, `kasikorn`), `account` identifies
which balance a transaction actually hits, since one bank can have more
than one (DBS Main vs PayLah! -- linked but tracked separately by DBS
itself, confirmed by PayLah! alerts using their own sender and template).
Every parser sets `account` explicitly; there is no bank-level default.
`DBS Main` is the default for existing/manual rows predating this field.

## DBS alerting rules (why this system is shaped the way it is)

Verified from DBS's iBanking notification documentation and confirmed
against a real inbox:

- **Card alerts are threshold-gated, default S$500**, across AMEX,
  Mastercard, NETS, UnionPay and Visa.
- **Funds transfer alerts default to S$100.**
- **Digital transaction alerts are mandatory** (email + push, cannot be
  disabled). Confirmed: a S$1.20 NETS Scan & Pay (app-initiated QR payment)
  alerted immediately -- app-initiated QR is a digital transaction, not a
  card-network transaction, so the S$500 card gate does not apply to it.
  A physical-card NETS terminal payment under S$500 may still be invisible;
  do not assume the QR behaviour extends to it without a sample.
- **Recurring transactions never alert, at any threshold.** Subscriptions,
  utility bills, telco bills, loan payments -- structurally invisible to
  email capture. This is the reason `finance_recurring` exists as a
  declared-not-captured concept (see roadmap below); do not expect a
  parser fix to ever surface these.
- Card purchases show **pending** first (held ~10 days for merchant
  settlement, dropped if it never settles), then post.

**This account runs all DBS alert thresholds at S$0** (digibank -> More ->
Manage Notifications, both Accounts and Cards). With that set, one-off card
purchases should alert regardless of amount, making the card sub-parser
worth writing once a sample exists. It also means this inbox now receives
many DBS emails that are not transactions at all -- GIRO/standing
instruction setup, card activation/replacement, password/PIN changes,
personal particulars updates, login/device alerts, notification-preference
changes, statement-ready notices, marketing. `parsers/dbs/__init__.py`'s
`IGNORED_SUBJECT_PATTERNS` filters these out **before** they reach a
sub-parser, so they don't become garbage `$0.00` rows or flood
`finance_unmatched`.

### Extending the ignore list

DBS does not use one uniform subject convention. NETS Scan & Pay's subject
is descriptive (`digibank Alert - Successful NETS Scan & Pay`); PayNow's is
the generic `iBanking Alerts` with no transaction-type info at all
(confirmed from real samples of both). `IGNORED_SUBJECT_PATTERNS` assumes
the descriptive shape, which is unverified for non-transactional alert
types -- if a pattern doesn't match, that email lands in `finance_unmatched`
(safe) rather than being silently ignored (unsafe), but it still means the
list needs correcting from real data, not just extending:

```
python diagnose.py --list-subjects            # last 90 days, from ibanking.alert@dbs.com
python diagnose.py --list-subjects --days 30 --sender kasikornbank.com
```

Add a pattern to `IGNORED_SUBJECT_PATTERNS` in `parsers/dbs/__init__.py` for
anything non-transactional; leave transactional subjects alone so they fall
through to `NeedsReview` (-> `finance_unmatched`) until a sub-parser is
written for them.

## One-time setup

1. **Gmail OAuth** -- create a Google Cloud project, enable the Gmail API,
   create an OAuth client of type "Desktop app". Run `python authorize_gmail.py`
   locally (never in CI) to sign in and mint a refresh token.
2. **GitHub repo secrets** -- add these under Settings -> Secrets -> Actions:
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (from step 1)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role, not anon --
     this job bypasses RLS and writes directly with `FINANCE_USER_ID`)
   - `FINANCE_USER_ID` -- the `auth.users.id` these rows belong to
3. **Run the SQL files in `migrations/`** against the Supabase project, in
   order, before the first sync after pulling this change.
4. Trigger the workflow once manually ("Run workflow" in the Actions tab)
   to confirm it runs clean, then let the cron take over.

## Local testing

```
pip install -r requirements.txt
set -a; source .env; set +a   # after filling in .env from .env.example
python sync.py --dry-run      # prints parsed transactions, writes nothing
```

## Running tests

```
pip install -r requirements.txt
pytest tests/ -v
```

Tests run against redacted `.eml` fixtures in `tests/fixtures/` -- no
network, no real credentials needed. The GitHub Actions workflow runs this
same suite before every sync and blocks the sync job if it fails.

## Reading the unmatched list

Anything a parser's sender claims but no sub-parser recognises lands in the
`finance_unmatched` table (`gmail_id, sender, subject, received_at,
snippet, reason, resolved`) instead of only printing to the Actions log and
vanishing. Query it directly, or use the Finance tab's unmatched inbox once
built. Ignored non-transactional alerts (see above) do **not** appear here
-- only genuinely unrecognised transactional-looking emails do.

## Capturing and redacting a sample for a new sub-parser

1. Forward yourself a real notification email.
2. Save the raw `.eml` **outside the repo**, or use Gmail's "Show original"
   -> Download to grab the raw source.
3. Run `python redact_sample.py path/to/raw.eml tests/fixtures/<name>.eml`.
   This masks account-ending digits, transaction refs, UEN-shaped numbers,
   and long digit runs -- it does **not** catch names or merchant strings,
   so review the output by hand before committing.
4. Write the sub-parser against the redacted fixture (see
   `parsers/dbs/nets_scan_pay.py` for the pattern: claim by subject via a
   `SUBJECT_RE`, extract fields with the shared regexes in
   `parsers/dbs/common.py`, return a `Transaction`).
5. Register it in `parsers/dbs/__init__.py`'s `SUB_PARSERS` list.
6. Add a test in `tests/` asserting the extracted fields against the
   redacted fixture's values.
7. Add any new merchant keywords you see to `categorize.py`.

**Never commit an unredacted bank email or a real account number/reference.**
`.gitignore` excludes `parsers/Example_template/` and any raw `.eml` outside
`tests/fixtures/` for this reason -- but `redact_sample.py` is what makes
that easy to actually follow, not just documented.

## Known coverage gaps

This system cannot see everything DBS does with money, and it does not try
to pretend otherwise:

- **Recurring payments** (subscriptions, utility/telco bills, loan
  payments) never alert at any DBS threshold -- no parser fix is possible.
  Declare them instead: the Finance tab's Recurring section writes to
  `finance_recurring`, and `recurring.py` materializes one
  `finance_transactions` row per declaration per month it's due, marked
  `is_estimated = true` (shown as an ESTIMATED badge) so it's never
  confused with a bank-confirmed transaction. No cross-linking is
  attempted if a real alert for the same bill ever does arrive -- they'd
  show as two separate rows.
- **Anything below a threshold not yet zeroed.** Card purchases under
  S$500 (before the S$0 change took effect) never generated an email and
  were never captured. If thresholds drift back up, this gap reopens
  silently.
- **Cash.** No bank alert exists for cash spending; manual entry is the
  only capture path.
- **Card authorisations that never settle.** DBS drops these after ~10
  days with no further email -- if that happens, the row stays `pending`
  in `finance_transactions` indefinitely unless reconciled by hand.

## Adding a new bank (not DBS/Kasikorn)

1. Copy `parsers/example_bank.py` to `parsers/<bank_name>.py` (a single
   file is fine unless the sender emits several notification types the way
   DBS does -- in that case, follow the `parsers/dbs/` package pattern:
   a dispatching `__init__.py` plus one module per sub-type).
2. Set `SENDER` (or `SENDERS` for more than one address) to the real
   notification address.
3. Replace the regexes in `parse()` to match a real, captured-and-redacted
   sample. Watch for:
   - **Locale/calendar quirks** -- Thai banks sometimes use the Buddhist
     Era calendar (BE = year + 543) in SMS, though Kasikorn's K PLUS
     emails use Gregorian dates.
   - **Which party is "you"** -- for transfer-style notifications the same
     template is reused for money in and money out; detect direction from
     which side is "my account" rather than hardcoding debit/credit.
4. Register the module in `parsers/__init__.py`'s `PARSERS` list.
5. Add any new merchant keywords you see to `categorize.py`.
6. Write a test against a redacted fixture (see "Capturing and redacting a
   sample" above).

## Roadmap

All phases of the original spec are built. Ideas for later, not currently
planned:

- GIRO / FAST transfer / ATM withdrawal / salary credit DBS sub-parsers --
  still scaffolded, waiting on real samples (see "Extending the ignore
  list" above and `diagnose.py --list-subjects`).
- A currency-conversion option for the 6-month trend and stats, instead
  of always picking the dominant currency and listing the rest
  unconverted.

### Built

- **Finance tab upgrades** (Phase 3): month navigation, six-month trend,
  search/filter, inline edit/delete with a confirm step, a paste-an-alert
  box (best-effort client-side extraction into the manual-entry form),
  unmatched inbox UI, pending badge, spending-by-payment-method, CSV
  export, and a coverage-honesty line near the totals.
- **Recurring transaction declarations** (Phase 4): `finance_recurring`
  table, `recurring.py` materializer (run from `sync.py` on every sync),
  and a Recurring section in the Finance tab -- see "Known coverage gaps"
  above for how it works.
- **Statement reconciliation import** (Phase 5): `js/finance-reconcile.js`
  parses a CSV/XLSX export in-browser via a user-driven column mapping
  (no fixed DBS template assumed) and matches it against
  `finance_transactions` to surface anything email capture missed. Nothing
  about the import is persisted -- only explicit "Add" actions on missed
  rows write real transactions.
