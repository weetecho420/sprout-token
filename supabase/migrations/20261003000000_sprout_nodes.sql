-- Sprout Node network: which licenses are online, their uptime and unclaimed $SPROUT.
-- Writes only happen through the sprout-node Edge Function (service role).

create table public.sprout_config (
  id int primary key default 1 check (id = 1),
  collection text,                                      -- Grower Node license collection address
  rpc_url text not null default 'https://api.devnet.solana.com'
);
insert into public.sprout_config (id) values (1);

create table public.sprout_nodes (
  asset text primary key,                               -- license NFT address
  owner text not null,                                  -- wallet that last ran it
  name text,
  uptime_seconds numeric not null default 0,
  earned numeric not null default 0,                    -- unclaimed $SPROUT
  last_seen timestamptz,                                -- last heartbeat; null when stopped
  verified_at timestamptz,                              -- last on-chain ownership check
  created_at timestamptz not null default now()
);
create index sprout_nodes_owner_idx on public.sprout_nodes (owner);

create table public.sprout_sessions (
  token uuid primary key default gen_random_uuid(),
  owner text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sprout_sessions_owner_idx on public.sprout_sessions (owner);

alter table public.sprout_config enable row level security;
alter table public.sprout_nodes enable row level security;
alter table public.sprout_sessions enable row level security;

-- Node status and the collection address are public (they're on-chain facts anyway).
create policy "Anyone can read node status" on public.sprout_nodes for select to anon, authenticated using (true);
create policy "Anyone can read the public config" on public.sprout_config for select to anon, authenticated using (true);
-- sprout_sessions has no policies: only the Edge Function can touch it.

-- $SPROUT per day for a node, by how long it has been online in total (Seed → Hero).
create function public.sprout_rate(uptime numeric) returns numeric
language sql immutable set search_path = '' as $$
  select (case
    when uptime < 7 * 86400 then 50
    when uptime < 21 * 86400 then 75
    when uptime < 45 * 86400 then 110
    when uptime < 90 * 86400 then 150
    else 200 end)::numeric
$$;

-- Credits online time since each node's last heartbeat. Gaps longer than p_gap seconds
-- count as offline. Row locks stop two devices from double-counting the same minutes.
create function public.sprout_credit(p_assets text[], p_gap int default 180)
returns setof public.sprout_nodes
language sql security definer set search_path = '' as $$
  with d as (
    select asset,
      case when last_seen is not null and now() - last_seen <= make_interval(secs => p_gap)
        then extract(epoch from now() - last_seen) else 0 end as secs
    from public.sprout_nodes
    where asset = any(p_assets)
    for update
  )
  update public.sprout_nodes n set
    uptime_seconds = n.uptime_seconds + d.secs,
    earned = n.earned + d.secs / 86400.0 * public.sprout_rate(n.uptime_seconds),
    last_seen = now()
  from d
  where n.asset = d.asset
  returning n.*
$$;
revoke all on function public.sprout_credit(text[], int) from public, anon, authenticated;
grant execute on function public.sprout_credit(text[], int) to service_role;
