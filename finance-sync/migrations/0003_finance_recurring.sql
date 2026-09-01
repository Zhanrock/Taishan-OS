-- Phase 4: recurring transactions never alert at any DBS threshold (see
-- README's "DBS alerting rules"), so they structurally cannot be captured
-- by email parsing. finance_recurring holds user-declared recurring
-- bills/income; sync.py materializes one finance_transactions row per
-- declaration per month it's due, marked is_estimated so the UI can tell
-- a declared guess apart from a bank-confirmed transaction.
--
-- day_of_month is capped at 1-28 deliberately -- every month has at least
-- 28 days, so this avoids any month-end clamping logic (Feb 30th, etc.)
-- for what is already an estimate, not a real transaction date.
create table if not exists public.finance_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  amount numeric not null,
  currency text not null default 'SGD',
  direction text not null default 'debit',
  category text not null default 'bills',
  day_of_month smallint not null check (day_of_month between 1 and 28),
  active boolean not null default true,
  started_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.finance_recurring enable row level security;

create policy "Users own their data" on public.finance_recurring
  for all using (auth.uid() = user_id);

alter table public.finance_transactions
  add column if not exists is_estimated boolean not null default false;
