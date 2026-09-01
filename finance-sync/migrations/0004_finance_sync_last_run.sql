-- last_synced_at is a watermark for the Gmail query window (newest fetched
-- message's own Date header, minus a 2-day overlap buffer -- see
-- sync.py's next_sync_window()). It only advances when new mail is found,
-- so it cannot answer "did the sync job actually run recently" -- a run
-- with zero new messages leaves it untouched. last_run_at is a separate,
-- unconditional timestamp sync.py sets at the end of every live run
-- (dry-run excluded), so the UI can show real "last synced" freshness.
alter table public.finance_sync_state
  add column if not exists last_run_at timestamptz default now();

update public.finance_sync_state
  set last_run_at = last_synced_at
  where last_run_at is null;
