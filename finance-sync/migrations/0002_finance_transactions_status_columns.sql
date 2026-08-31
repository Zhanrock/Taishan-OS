-- Phase 2: columns the new DBS sub-parser family populates.
--   status          -- 'pending' | 'posted' | 'unknown'. Card authorisations
--                       land as pending; NETS QR/PayNow post immediately.
--   payment_method  -- 'paynow' | 'nets_qr' | 'nets_card' | 'card' |
--                       'contactless' | 'giro' | 'fast' | 'atm' | 'manual'
--   txn_ref         -- DBS's own "Transaction Ref" -- used by sync.py's
--                       dedup/soft-merge to catch a purchase that emails
--                       both an authorisation and a settlement.
alter table public.finance_transactions
  add column if not exists status text not null default 'posted',
  add column if not exists payment_method text,
  add column if not exists txn_ref text;

-- Non-unique: two independent transactions coincidentally sharing a ref is
-- not something to hard-fail on. Application-level dedup in sync.py is
-- authoritative; this index just makes that lookup fast.
create index if not exists finance_transactions_txn_ref_idx
  on public.finance_transactions (user_id, txn_ref)
  where txn_ref is not null;
