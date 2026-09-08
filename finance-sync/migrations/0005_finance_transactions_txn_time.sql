-- txn_time is the clock time (HH:MM, 24h) from the same bank alert body the
-- parsers already read for txn_date -- previously parsed and discarded.
-- Nullable: older rows and any parser variant that can't find a time in the
-- body simply have none, same as a manual entry.
alter table public.finance_transactions
  add column if not exists txn_time text;
