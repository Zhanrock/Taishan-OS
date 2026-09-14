-- "account" distinguishes which balance a transaction belongs to, separate
-- from "bank" -- a single bank can have more than one (DBS Main vs PayLah!,
-- both bank='dbs'), and this is also the join point for a future non-DBS
-- account (a Thai bank) once one is used again. Defaults to 'DBS Main' on
-- backfill: every existing row (all synced DBS/POSB card, PayNow, NETS
-- Scan & Pay activity, plus every manual entry so far) was in fact that
-- account -- PayLah! and Kasikorn are net-new as of this migration.
alter table public.finance_transactions
  add column if not exists account text not null default 'DBS Main';

alter table public.finance_recurring
  add column if not exists account text not null default 'DBS Main';
