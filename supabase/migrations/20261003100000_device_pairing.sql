-- Desktop (and later Android) node apps pair once with a wallet, then run on their own.
--   1. The app calls pair-start with a random secret and gets a short code (shown as a QR).
--   2. On the phone, the wallet signs a message containing that code (pair-approve).
--   3. The app polls pair-check with its secret and receives a long-lived device session.

alter table public.sprout_sessions add column kind text not null default 'web';
alter table public.sprout_sessions add column device text;

create table public.sprout_pairings (
  code text primary key,                 -- e.g. 'K7QX-M2PD', shown to the user
  secret_hash text not null,             -- sha-256 of the app's secret; only the app can collect the session
  device text,                           -- "Henry's PC"
  owner text,                            -- wallet, set once approved
  token uuid,                            -- device session, set once approved
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.sprout_pairings enable row level security;
-- No policies: only the Edge Function (service role) reads or writes pairings.
