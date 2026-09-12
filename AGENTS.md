# Taishan OS

Vanilla HTML/CSS/JS PWA. No framework, no build step, no bundler — files are
served as-is by GitHub Pages. Don't introduce a build step without asking.

Backend is Supabase (auth, Postgres, realtime). Frontend is `js/*.js` loaded
in order from `index.html`; there are no modules or imports.

## Invariants

- **RLS is the security boundary.** The anon key is readable by anyone and
  that's fine. Every table must have `enable row level security` and an
  `auth.uid() = user_id` policy. A new table without a policy is a real
  vulnerability, not a todo.
- **No personal data in shipped source.** Anything in `js/` reaches the
  browser, and Pages serves the site publicly even though this repo is
  private — repo visibility is not the lever. No employer, collaborator,
  module, supervisor, or project names. `DEFAULT_DOMAINS` and
  `DEFAULT_TASKS` are generic seed data and stay that way. Real content
  lives in Supabase rows.
- **Schema changes update the README.** The SQL block in README.md is what
  someone forking this runs. If a table or column is added, changed, or newly
  queried in `js/data.js`, update the SQL block in the same commit.
- **Bump the version.** Header version and the Version History table at the
  bottom of README.md, together, in the same commit.

## Maintaining this file

Update this file in the same commit as the change that makes it wrong.

- Delete a Known drift item when it's fixed. Delete the whole section
  when it's empty. Do not leave fixed items as history.
- Add an invariant when a mistake here gets made twice, or when a code
  review catches something a session should have known.
- Add it here only if it applies to every session. One-off procedures
  belong in a skill; anything Claude can read off the codebase belongs
  nowhere.
