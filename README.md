# ▸ TAISHAN OS

> *Your personal operating system. Cloud-synced. Algorithm-driven. Built for a life with too much going on.*

**v2.9.23** · [Live →](https://zhanrock.github.io/Taishan-OS/)

---

## What is this?

TAISHAN OS is a personal productivity system built as a Progressive Web App (PWA). It's not a generic to-do app — it's a full life management layer designed around one person's actual situation: work/internship, research projects, fitness goals, cybersecurity practice, finance learning, and protected downtime.

Everything syncs to Supabase in real time. Open it on your phone, your laptop, anywhere — same state, same data.

---

## Features

### 🔥 Streaks
Habit tracking with a **Progressive Unlock System** — start with 2 core anchors (Wake Up + Morning Routine), unlock more habits as your streak grows across 3 phases. Includes a **System Integrity Score** (0–100%) based on your 7-day weighted consistency, sleep logging with grace rules, and a 25-minute deep work focus timer.

### ◈ Daily Planner — Auto-Generator
The centrepiece. Every morning, hit **GENERATE MY DAY** and an algorithm builds your day automatically:

```
score = (base_priority × 10) + overdue_penalty + urgency_boost
```

- **Base priority** — each domain has a 1–10 score
- **Overdue penalty** — +8 per day past your ideal frequency (so skipped things rise naturally)
- **Urgency boost** — calendar events matching a domain's title words spike its score in the days before
- **Guardrails** — max 3 work blocks, max 2 study blocks, 1 physical session, 1 leisure block always protected

Tasks are fully editable after generation. Manually add anything the algorithm missed. **Re-Score & Rebuild** re-runs the algorithm with your current completion data — keeps done tasks, replaces pending ones.

### ⚙ Domain Manager
All your life domains (interests, commitments, goals) live in Supabase and sync across devices. Add new interests anytime via the UI — no code needed. Each domain has: category, frequency, priority, time slot, duration, and a session note.

**Domain categories:** work/internship, research projects, part-time roles, skill practice, finance learning, fitness, reading, gaming, plus the always-on Morning Anchor and Night Protocol habits. Fully customizable per account — the shipped defaults are a generic starting template, not any one person's actual commitments.

### ◈ Domain Library
Every domain gets its own detail page: links (Overleaf, course portals, game accounts), notes, checklists, progress logs, and multi-phase structured programs (e.g. a training plan with phases/days/exercises). Accessible standalone from the Domains tab, or via a "view details" shortcut from any Daily Planner task. All content is stored per-account in Supabase — nothing personal is ever shipped in the app's source code.

### ✦ Tasks
Assignment and project tracker with deadlines, categories (Module, Research, Hackathon, Personal), priority levels, and a pinned "Today's Priority" slot. Countdown banners for anything due in the next 14 days.

### 📅 Calendar
Monthly calendar with heat-map intensity (HOT / WARM / MILD / COOL weeks based on event density). Supports one-off and recurring events (e.g. weekly classes for a full semester, including odd-week / even-week alternating classes counted from the semester start). Tap any day to see its events. Upcoming 14-day view below the grid. Calendar events feed urgency data into the Day Generator.

### ◆ Schedule
Your fixed daily time-block template — the rhythm your day runs on. Editable blocks with types: Anchor, Deep Work, Reset, Free. Deep Work blocks have an integrated 25-minute Pomodoro timer that auto-checks your Deep Work streak on completion. Night Protocol checklist + Tomorrow's Briefing + Morning Activation Card system.

### ◎ Weekly Review
Sunday ritual. Four reflection prompts: next week's ONE priority, what tripped you up, what you'll change, and a streak reflection. All reviews saved and viewable.

### ⚛ Finance
Bank transaction/notification emails get pulled from Gmail on a schedule (`finance-sync/`, runs via GitHub Actions — see that folder), parsed per-bank, auto-categorized, and synced into Supabase. The Finance tab shows this month's spend/income/net, a category breakdown, and the full transaction list with an inline category override. You can also log a transaction manually for anything that doesn't arrive by email (cash, etc).

---

## Tech Stack

| Layer | What |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework, no build step |
| Fonts | Space Mono (monospace) + Syne (display) |
| Backend | [Supabase](https://supabase.com) — Auth, Postgres, Realtime |
| Hosting | GitHub Pages |
| PWA | Installable on iOS and Android |

---

## Database Tables

All tables use Supabase Row Level Security — users can only access their own data.

```sql
-- Habit streaks + misc per-user key/value state. `count` is text, not an
-- integer -- non-streak rows (scheduleBlocks, sleepLog, sleepHistory,
-- nightProtocolItems, morningCard, financeCustomCategories) stash a JSON
-- blob in last_checked and a date string in count instead of a real streak.
habits (user_id, habit_id, count, last_checked, history)

-- Assignment / project tasks
tasks (user_id, name, category, due, priority, note, done, created_on)

-- Calendar events (one-off + recurring). recur_id links occurrences of the
-- same recurring event; there is no cancelled column.
events (user_id, title, date, time, end_time, type, note, priority, recur_id)

-- Weekly review entries
reviews (user_id, date, r1, r2, r3, r4, created_at)

-- Daily life tasks (generated + manual). domain_id is set when the row came
-- from a user_domains row; source_type/source_id are set instead when it
-- came from a tasks or events row (deadline surfaced by the day generator —
-- see below). A row has at most one of the two set, never both. end_time is
-- only populated for rows with a real end (a domain's time+duration, or an
-- event happening today with its own end_time) — null otherwise.
daily_tasks (user_id, title, cat, pri, time, end_time, done, date, note,
             domain_id, source_type, source_id, created_at)

-- Life domain profiles (the algorithm's input) + per-domain detail content
user_domains (user_id, domain_id, title, cat, pri, time_slot, duration_mins,
              freq_days, base_priority, urgency_deadline_days, tags, note,
              detail_content)  -- jsonb array of blocks: link / note / checklist /
                                -- progress_log / program — see js/domains.js

-- Domain completion tracking (drives overdue scoring)
user_domain_progress (user_id, domain_id, last_done)

-- Bank transactions, synced from Gmail by finance-sync/ (see that folder's README)
finance_transactions (user_id, external_id, bank, account_mask, txn_date,
                       txn_time, amount, currency, direction, merchant,
                       category, raw_subject, status, payment_method,
                       txn_ref, is_estimated)

-- Bank notification emails finance-sync couldn't parse, surfaced in the
-- Finance tab's Unmatched Inbox instead of silently dropped
finance_unmatched (user_id, gmail_id, sender, subject, received_at, snippet,
                    reason, resolved, created_at)

-- User-declared recurring bills/income that never trigger a bank email alert;
-- finance-sync materializes one finance_transactions row per due date, marked
-- is_estimated
finance_recurring (user_id, name, amount, currency, direction, category,
                    day_of_month, active, started_on, created_at)

-- Cursor for the finance-sync job. last_synced_at is the Gmail query
-- watermark (only advances when new mail is found); last_run_at is set
-- unconditionally at the end of every live run, so the UI can show real
-- "last synced" freshness even on a run that found nothing new.
finance_sync_state (user_id, last_synced_at, last_run_at)
```

---

## File Structure

```
taishan-os/
├── index.html          # Single-page app shell + all panels
├── css/
│   ├── base.css        # CSS variables, typography, global reset
│   ├── auth.css        # Login / signup overlay
│   ├── layout.css      # Header, tabs, panels, notifications
│   ├── streaks.css     # Streak cards, phase banner, integrity score
│   ├── tasks.css       # Task list, add form, countdown banners
│   ├── calendar.css    # Calendar grid, events, heat-map
│   ├── schedule.css    # Time blocks, focus timer, night protocol
│   ├── daily.css       # Daily planner, domain manager, generator UI
│   ├── domains.css     # Domain library grid + detail page (blocks, phases)
│   └── finance.css     # Finance tab: stat cards, category bars, transaction list
├── finance-sync/       # Python job (GitHub Actions cron) that pulls bank emails
│   │                   # from Gmail, parses them, and upserts finance_transactions
│   ├── sync.py          # entrypoint
│   ├── parsers/          # one module per bank + registry + unmatched-email logger
│   ├── categorize.py     # merchant keyword -> category
│   └── authorize_gmail.py # one-time local OAuth refresh-token setup
└── js/
    ├── config.js       # Supabase client, habit/schedule/card definitions
    ├── state.js        # Global state object, helpers, utility functions
    ├── auth.js         # Login, signup, sign out, localStorage cleanup
    ├── data.js         # loadAllData(), Supabase fetches, realtime subscriptions
    ├── streaks.js      # Streak logic, phase system, integrity score, week grid
    ├── tasks.js        # Task CRUD, pinned task, countdown render
    ├── daily.js        # Day Generator algorithm, domain manager, daily CRUD
    ├── domains.js      # Domain Library: generic block renderer/editor for
    │                   # every domain's detail page (links, notes, checklists,
    │                   # progress logs, phased programs)
    ├── calendar.js     # Calendar render, event CRUD, recurring events
    ├── schedule.js     # Schedule blocks, focus timer, night protocol, sleep log
    ├── review.js       # Weekly review save/load
    ├── sleep.js        # Sleep grace level calculation
    ├── finance.js      # Finance tab: stats, category breakdown, txn list, manual add
    └── app.js          # Tab switching, initApp(), renderAll()
```

---

## Setup (self-hosting)

1. Fork the repo
2. Create a [Supabase](https://supabase.com) project
3. Run the SQL below in the Supabase SQL editor
4. Add your Supabase URL and anon key to `js/config.js`
5. Enable GitHub Pages on the `main` branch

```sql
-- Run all of these in order

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id text not null, count text default '0',
  last_checked text, history text[] default '{}',
  unique(user_id, habit_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, category text default 'personal', due text,
  priority text default 'med', note text default '',
  done boolean default false, created_on text,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, date text not null, time text,
  end_time text, type text default 'meeting', note text,
  created_at timestamptz default now(),
  priority text default 'normal', recur_id text
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text, r1 text, r2 text, r3 text, r4 text,
  created_at timestamptz default now()
);

create table daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null, cat text default 'other',
  pri text default 'medium', time text, done boolean default false,
  date text not null, created_at timestamptz default now(),
  domain_id text, note text,
  source_type text, source_id uuid, end_time text
);

create table user_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  domain_id text not null, title text not null,
  cat text default 'other', pri text default 'medium',
  time_slot text, -- null = "flexible": fills free gaps between fixed/
                  -- guaranteed blocks in the generated day instead of a
                  -- fixed clock position (js/daily.js: computeGaps())
  duration_mins int default 45,
  freq_days int default 2, base_priority int default 5,
  urgency_deadline_days int default 7,
  tags text[] default '{}', note text default '',
  created_at timestamptz default now(),
  detail_content jsonb default '[]'::jsonb,
  is_archived boolean not null default false,
  unique(user_id, domain_id)
);

create table user_domain_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  domain_id text not null, last_done text,
  unique(user_id, domain_id)
);

create table finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  external_id text not null,
  bank text not null, account_mask text,
  txn_date date not null, txn_time text,
  amount numeric(12,2) not null,
  currency text default 'THB', direction text not null,
  merchant text, category text default 'uncategorized',
  raw_subject text,
  created_at timestamptz default now(),
  status text not null default 'posted',
  payment_method text, txn_ref text,
  is_estimated boolean not null default false,
  unique(user_id, external_id)
);

-- Non-unique: two independent transactions coincidentally sharing a ref is
-- not something to hard-fail on. Speeds up sync.py's dedup/soft-merge lookup
-- for a purchase that emails both an authorisation and a settlement.
create index finance_transactions_txn_ref_idx
  on finance_transactions (user_id, txn_ref)
  where txn_ref is not null;

-- Bank emails finance-sync couldn't parse (surfaced in the Finance tab's
-- Unmatched Inbox instead of vanishing into a GitHub Actions log)
create table finance_unmatched (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  gmail_id text not null,
  sender text, subject text, received_at timestamptz,
  snippet text, reason text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, gmail_id)
);

-- User-declared recurring bills/income that never trigger a bank alert (see
-- finance-sync/'s "DBS alerting rules"), so they can't be captured by email
-- parsing. day_of_month is capped at 1-28 to avoid month-end clamping logic
-- for what is already an estimate, not a real transaction date.
create table finance_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null, amount numeric not null,
  currency text not null default 'SGD',
  direction text not null default 'debit',
  category text not null default 'bills',
  day_of_month smallint not null check (day_of_month between 1 and 28),
  active boolean not null default true,
  started_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table finance_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_synced_at timestamptz not null default now(),
  last_run_at timestamptz default now()
);

-- Enable RLS on all tables
alter table habits enable row level security;
alter table tasks enable row level security;
alter table events enable row level security;
alter table reviews enable row level security;
alter table daily_tasks enable row level security;
alter table user_domains enable row level security;
alter table user_domain_progress enable row level security;
alter table finance_transactions enable row level security;
alter table finance_unmatched enable row level security;
alter table finance_recurring enable row level security;
alter table finance_sync_state enable row level security;

-- RLS policies (repeat pattern for each table)
create policy "Users own their data" on habits for all using (auth.uid() = user_id);
create policy "Users own their data" on tasks for all using (auth.uid() = user_id);
create policy "Users own their data" on events for all using (auth.uid() = user_id);
create policy "Users own their data" on reviews for all using (auth.uid() = user_id);
create policy "Users own their data" on daily_tasks for all using (auth.uid() = user_id);
create policy "Users own their data" on user_domains for all using (auth.uid() = user_id);
create policy "Users own their data" on user_domain_progress for all using (auth.uid() = user_id);
create policy "Users own their data" on finance_transactions for all using (auth.uid() = user_id);
create policy "Users own their data" on finance_unmatched for all using (auth.uid() = user_id);
create policy "Users own their data" on finance_recurring for all using (auth.uid() = user_id);
create policy "Users own their data" on finance_sync_state for all using (auth.uid() = user_id);
```

---

## Version History

| Version | What changed |
|---|---|
| v2.9.23 | Daily Planner's "current block" indicator was just a color change on the small time text (`.di-time.now`), easy to miss scanning the list -- the whole card now gets a tint/border/glow plus a `● NOW` badge in the meta row when it's within 30min of now. Also fixed `extractLikelyCurrency`/`extractLikelyAmount` (the Unmatched-Inbox-to-manual-entry paste helper) only recognizing THB as a non-SGD currency and silently defaulting anything else, USD included, to SGD -- now detects any 3-letter currency code generically, same as the real parser. |
| v2.9.22 | A never-done domain (`last_done` null) scored a flat +20 forever instead of climbing the overdue ramp like everything else -- once any other domain in its category had been ticked even once, it permanently outscored the never-done one, which could then never surface to get ticked. It now climbs the same `(daysSince - freqDays) * 8` ramp counted from `created_at` instead. Guitar and Chinese (created 2026-09-07, never surfaced since) were the domains stuck in this deadlock. |
| v2.9.21 | Guaranteed deadlines (a task due within 3 days, an exam/deadline heads-up) previously never got a clock time even when a gap-fill slot was free -- they were pushed straight into the plan as a bare no-time reminder. They now get first claim on gap-fill space (ahead of flexible domains and non-urgent tasks), falling back to no-time only if a gap genuinely isn't available. Domain detail pages gained an edit form (title, category, priority, frequency, time slot/flexible, duration, urgency deadline, note) -- previously the only way to change an existing domain's scheduling stats was a direct Supabase edit. Morning Anchor and Night Protocol's notes now point at the Schedule tab (Night Protocol checklist, Morning Card) and Streaks tab (Wake Up / Morning Routine) instead of restating a routine that already lives there and can drift out of sync. |
| v2.9.20 | Gap-fill's study/work quota (v2.9.19) removed entirely -- it only ever spends time nothing else claimed, so the category balance the main scoring loop protects isn't at stake there, and the quota was blocking nothing real anyway (the actual limit on a free day is how few flexible domains/tasks exist, not a cap). Module Reading can now fill one gap-fill slot per upcoming module (`resolveModuleReadingTargets`, up to 3, nearest-class-first) instead of always just the single nearest one. |
| v2.9.19 | Gap-fill now runs its own study/work quota separate from the main scoring loop's. Previously the day's whole study/work cap could be exhausted by evening-fixed domains (e.g. Cybersecurity Practice, Finance, Chinese all landing before gap-fill runs), leaving a large daytime gap unfillable even with an available flexible domain like Module Reading sitting unused. |
| v2.9.18 | The v2.9.17 fixes exposed two more bugs. A hardcoded 9-item cap in the day generator's main scoring loop (separate from the study/work/health per-category caps) silently dropped low-scoring `personal`-cat domains once anchors and guaranteed deadlines ate into its budget -- Guitar lost its slot to Chinese this way with no guarantee fallback to catch it (health/leisure already had one). The flat cap is removed; the per-category caps and the day's actual clock time already bound how much fits. Also found Cybersecurity Practice and Chinese sharing the same 21:00 time_slot with no conflict detection between fixed domains -- Chinese moved to 20:00 in Supabase. In-app header (`index.html` `.logo`) was still showing v2.9.15 two releases behind; the version-bump invariant now covers it explicitly alongside README. |
| v2.9.17 | Gap-fill (v2.9.15) placed only one flexible item per free window no matter how large -- a weekend with no fixed blocks left most of the day empty after a single 45-60min filler. It now tiles candidates back-to-back until the gap runs out of space or candidates, same caps as before. Also raised the daily study cap (MAX_STUDY) from 2 to 3 -- with 4 study-cat domains competing for fixed slots (e.g. a daily-frequency one with no overdue bonus to build up, alongside higher-priority or longer-interval ones), the lowest-priority daily study domain could go unscheduled for long stretches. |
| v2.9.16 | Header version had drifted behind the Version History table again (last said v2.9.9 while history already ran to v2.9.15) -- corrected to match. Verified directly against live Supabase that `finance_unmatched`, `finance_recurring`, and `finance_sync_state.last_run_at` (flagged as missing from the README SQL block since v2.9.5) were already added in v2.9.8's schema-doc fix and match the live schema column-for-column, with RLS enabled and an owner-scoped policy on all four finance tables -- no vulnerability found, this was a stale doc note, not a live gap. |
| v2.9.15 | Day generator can now fill free time between fixed/guaranteed blocks: a domain with no time_slot ("flexible") or an untimed deadline candidate (a task due in 4-7 days, an upcoming exam heads-up) competes to fill each gap ≥20min, sized to its own duration, still respecting the study/work caps. New flexible domain "Module Reading" resolves which module to read based on the nearest class event within 3 days. `research_p1` converted to flexible. Domain Manager's add-form gained a "Flexible" checkbox. |
| v2.9.14 | Manual Finance transactions can now set a time (optional). Daily Planner's "add task" priority dropdown used a black square for Medium instead of the yellow circle Tasks uses -- now consistent. |
| v2.9.13 | Finance transactions now capture the actual transaction time, not just the date -- the bank alert emails already carried it (`Date & Time: ...`), it was parsed and discarded. All 4 live parsers (DBS card/PayNow/NETS Scan & Pay, Kasikorn) updated; `finance_transactions.txn_time` added. Same-day transactions are now sorted chronologically instead of arbitrarily, and the Finance tab shows the time next to the date. |
| v2.9.12 | Fixed the deadline-scoring feature shipped in v2.9.11: an event on a *future* day (not today) was being surfaced in today's plan at its own time-of-day, causing real time clashes with today's actual classes and flooding the plan with the whole week's timetable. Now only events happening *today* (any type) are guaranteed in with their real time; a future date only surfaces if it's an exam/deadline, with no time attached. Daily items now show an end time (domain duration, or an event's real end_time) alongside the start. Fixed a priority-vocabulary mismatch (`med` vs `medium`) that silently broke the priority color stripe on deadline-sourced items; the priority label itself is now color-coded. Daily Planner filters are now multi-select (toggle any combination) and include the previously-missing Personal/Chore/Other categories. |
| v2.9.11 | Day generator now scores today's open `tasks` (with a `due` date) and upcoming `events` alongside domains, not domains alone — a deadline within 7 days competes on the same score scale as a domain; within 3 days it's guaranteed into the plan regardless of category caps. Completing a task-sourced item in the Daily Planner marks the real task done too. `daily_tasks` gained `source_type`/`source_id` to track which task/event a row came from. |
| v2.9.10 | Task category dropdowns (add + edit) and `.tag-*` CSS were missing `project` and `career` — a `career` task (used by the careers-tracking hub project since 2026-09-08) or `project` task (used by seed data) rendered as an unstyled tag and got silently reset to `module` if edited through the UI. Both categories now render and edit correctly. |
| v2.9.9 | Domains can now be archived/retired instead of only deleted (`user_domains.is_archived`) — excluded from day generation and the default domain list, but stays readable with its logs intact; restore or permanently delete from the archived view. Logging a progress-log entry for today now also records `last_done` for that domain, so the overdue-penalty scoring reflects the log people actually keep instead of only the separate generated daily-task checkbox. |
| v2.9.8 | README's Database Tables section and self-hosting SQL corrected to match the live Supabase schema (verified via direct inspection, not assumption): added the missing finance_unmatched and finance_recurring tables, finance_sync_state.last_run_at, and finance_transactions' status/payment_method/txn_ref/is_estimated columns + txn_ref index; fixed habits.count (text, not int -- non-streak rows store a JSON blob there), reviews' actual column (date, not week), events (no cancelled column; added the undocumented recur_id), and tasks.created_on naming. Header version corrected to match this table. All 11 live tables confirmed to have RLS enabled with an owner-scoped policy -- no vulnerability found. |
| v2.9.7 | finance-sync no longer re-upserts a transaction whose email was re-fetched inside the sync overlap window -- previously this silently reverted any manual edit (category, merchant, amount, etc.) made in the Finance tab back to the freshly parsed values. Also added common Singapore F&B/retail/supermarket/cinema chains to auto-categorization. |
| v2.9.6 | DBS card transaction parser (covers physical/contactless/Google Wallet card alerts); finance tab shows when the transaction list was last synced and when the next scheduled sync runs; finance-sync now auto-resolves a stale Unmatched Inbox entry once a later fix lets that same email parse successfully. |
| v2.9.5 | Finance tab added: finance-sync/ (GitHub Actions cron) parses bank notification emails from Gmail per-bank and syncs finance_transactions to Supabase; UI shows monthly spend/income/net, category breakdown, transaction list with inline category correction, and manual entry. |
| v2.9.4 | Domain Library added (per-domain detail pages: links, notes, checklists, progress logs, phased programs). Shipped starter templates (DEFAULT_DOMAINS, DEFAULT_TASKS) genericized — no personal/employer/collaborator specifics live in source anymore, only in each account's own Supabase rows. |
| v2.9.3 | Domains + lastDone tracking migrated to Supabase; localStorage fully purged |
| v2.9.2 | Work category added to Daily Planner; domains updated to reflect current life |
| v2.9.1 | Domain Manager UI (add/remove interests at runtime); honest Re-Score & Rebuild button |
| v2.9.0 | Day Generator algorithm shipped; generate banner, auto-tags, domain scoring engine |
| v2.8.0 | Daily Planner tab added to Taishan OS |
| v2.6.0 | Calendar recurring events; schedule focus timer; morning card system |
| v1.0.0 | Initial build — streaks, tasks, schedule, weekly review |

---

*Built by [@Zhanrock](https://github.com/Zhanrock)*
