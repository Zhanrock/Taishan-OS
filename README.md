# ▸ TAISHAN OS

> *Your personal operating system. Cloud-synced. Algorithm-driven. Built for a life with too much going on.*

**v2.9.5** · [Live →](https://zhanrock.github.io/Taishan-OS/)

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
-- Habit streaks + misc state
habits (user_id, habit_id, count, last_checked, history)

-- Assignment / project tasks
tasks (user_id, name, category, due, priority, note, done, createdOn)

-- Calendar events (one-off + recurring)
events (user_id, title, type, date, time, end_time, note, priority, cancelled)

-- Weekly review entries
reviews (user_id, week, r1, r2, r3, r4, created_at)

-- Daily life tasks (generated + manual)
daily_tasks (user_id, title, cat, pri, time, done, date, note, domain_id, created_at)

-- Life domain profiles (the algorithm's input) + per-domain detail content
user_domains (user_id, domain_id, title, cat, pri, time_slot, duration_mins,
              freq_days, base_priority, urgency_deadline_days, tags, note,
              detail_content)  -- jsonb array of blocks: link / note / checklist /
                                -- progress_log / program — see js/domains.js

-- Domain completion tracking (drives overdue scoring)
user_domain_progress (user_id, domain_id, last_done)

-- Bank transactions, synced from Gmail by finance-sync/ (see that folder's README)
finance_transactions (user_id, external_id, bank, account_mask, txn_date, amount,
                       currency, direction, merchant, category, raw_subject)

-- Cursor for the finance-sync job — last time Gmail was successfully polled
finance_sync_state (user_id, last_synced_at)
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
  user_id uuid references auth.users(id) on delete cascade,
  habit_id text not null, count int default 0,
  last_checked text, history text[] default '{}',
  unique(user_id, habit_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text, category text, due text, priority text,
  note text, done boolean default false, createdOn text,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text, type text, date text, time text,
  end_time text, note text, priority text default 'normal',
  cancelled boolean default false,
  created_at timestamptz default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  week text, r1 text, r2 text, r3 text, r4 text,
  created_at timestamptz default now()
);

create table daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null, cat text default 'other',
  pri text default 'medium', time text, done boolean default false,
  date text not null, note text, domain_id text,
  created_at timestamptz default now()
);

create table user_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  domain_id text not null, title text not null,
  cat text default 'other', pri text default 'medium',
  time_slot text, duration_mins int default 45,
  freq_days int default 2, base_priority int default 5,
  urgency_deadline_days int default 7,
  tags text[] default '{}', note text default '',
  detail_content jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
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
  txn_date date not null, amount numeric(12,2) not null,
  currency text default 'THB', direction text not null,
  merchant text, category text default 'uncategorized',
  raw_subject text,
  created_at timestamptz default now(),
  unique(user_id, external_id)
);

create table finance_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_synced_at timestamptz not null default now()
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
create policy "Users own their data" on finance_sync_state for all using (auth.uid() = user_id);
```

---

## Version History

| Version | What changed |
|---|---|
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
