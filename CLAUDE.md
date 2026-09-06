# Taishan OS

Vanilla HTML/CSS/JS PWA. No framework, no build step, no bundler — files are
served as-is by GitHub Pages. Don't introduce a build step without asking.

Backend is Supabase (auth, Postgres, realtime). Frontend is `js/*.js` loaded
in order from `index.html`; there are no modules or imports.

## Invariants

- **RLS is the security boundary.** The anon key is public on purpose. Every
  table must have `enable row level security` and an `auth.uid() = user_id`
  policy. A new table without a policy is a real vulnerability, not a todo.
- **No personal data in this repo.** No employer, collaborator, module,
  supervisor, or project names. `DEFAULT_DOMAINS` and `DEFAULT_TASKS` are
  generic seed data and stay that way. Real content lives in Supabase rows.
- **Schema changes update the README.** The SQL block in README.md is what
  someone forking this runs. If a table or column is added, changed, or newly
  queried in `js/data.js`, update the SQL block in the same commit.
- **Bump the version.** Header version and the Version History table at the
  bottom of README.md, together, in the same commit.

## Known drift (fix when touching finance)

`js/data.js` queries `finance_unmatched` and `finance_recurring`, and selects
`last_run_at` from `finance_sync_state`. None are in the README SQL. The
header says v2.9.5 but history goes to v2.9.7.