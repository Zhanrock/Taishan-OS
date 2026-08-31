# finance-sync

Pulls bank transaction/notification emails from Gmail on a schedule, parses
them per-bank, auto-categorizes them, and upserts the results into Supabase
(`finance_transactions`). Runs via the `finance-sync.yml` GitHub Actions
workflow every 6 hours, or manually with the "Run workflow" button.

## Supported banks

| Bank | Notification type | Direction |
|------|-------------------|-----------|
| DBS (Singapore) | PayNow confirmations (`parsers/dbs.py`) | debit or credit, detected from the "My Account" side of the From/To lines |
| Kasikornbank (Thailand) | K PLUS "Result of Bill Payment (Success)" (`parsers/kasikorn.py`) | debit only |

Anything else from these senders — or any other bank — falls through to
`parsers/unmatched.py`, which prints `[unmatched] from=... subject=...` in
the GitHub Actions run log instead of silently dropping the email. Check
that log occasionally; it tells you which notification types still need a
parser.

## One-time setup

1. **Gmail OAuth** — create a Google Cloud project, enable the Gmail API,
   create an OAuth client of type "Desktop app". Run `python authorize_gmail.py`
   locally (never in CI) to sign in and mint a refresh token.
2. **GitHub repo secrets** — add these under Settings → Secrets → Actions:
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (from step 1)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role, not anon —
     this job bypasses RLS and writes directly with `FINANCE_USER_ID`)
   - `FINANCE_USER_ID` — the `auth.users.id` these rows belong to
3. Trigger the workflow once manually ("Run workflow" in the Actions tab)
   to confirm it runs clean, then let the cron take over.

## Local testing

```
pip install -r requirements.txt
set -a; source .env; set +a   # after filling in .env from .env.example
python sync.py --dry-run      # prints parsed transactions, writes nothing
```

## Adding a new bank

1. Forward yourself a real notification email and save the subject + body
   text somewhere *outside* the repo (or in a gitignored folder — see
   `.gitignore`'s `parsers/Example_template/` pattern — never commit real
   bank emails or screenshots).
2. Copy `parsers/example_bank.py` to `parsers/<bank_name>.py`.
3. Set `SENDER` to the real notification address, and tighten `matches()`
   with a subject/body check if that sender emits more than one
   notification type (see `kasikorn.py` for an example — it only claims
   "Bill Payment (Success)" emails, not transfers or failed payments).
4. Replace the regexes in `parse()` to match the real sample. Watch for:
   - **Locale/calendar quirks** — Thai banks sometimes use the Buddhist
     Era calendar (BE = year + 543) in SMS, though Kasikorn's K PLUS
     emails use Gregorian dates.
   - **Which party is "you"** — for transfer-style notifications (PayNow,
     GIRO, etc.) the same template is reused for money in and money out;
     detect direction from which side says "My Account" rather than
     hardcoding debit/credit.
5. Register the module in `parsers/__init__.py`'s `PARSERS` list.
6. Add any new merchant keywords you see to `categorize.py`.
7. Test with `python sync.py --dry-run` against a real inbox, or write a
   quick local script that builds an `email.message.EmailMessage` from the
   saved sample and calls `matches()`/`parse()` directly.
