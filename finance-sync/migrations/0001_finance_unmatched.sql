-- Phase 1: persist unmatched/needs-review DBS & Kasikorn emails instead of
-- letting them print to a GitHub Actions log and vanish. Surfaced in the
-- Finance tab's "Unmatched inbox" (Phase 3).
create table if not exists public.finance_unmatched (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  gmail_id text not null,
  sender text,
  subject text,
  received_at timestamptz,
  snippet text,
  reason text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_id)
);

alter table public.finance_unmatched enable row level security;

create policy "Users own their data" on public.finance_unmatched
  for all using (auth.uid() = user_id);
