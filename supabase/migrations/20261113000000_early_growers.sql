-- Sale list (waitlist) for the real Grower Node sale, and the Early Grower badge.
-- Joining is free: the wallet signs a message, nothing is paid.
-- Early Grower = a wallet on the list that has run beta nodes for at least 24 hours in total.
create table public.sprout_waitlist (
  owner text primary key,
  x_handle text,
  created_at timestamptz not null default now()
);
alter table public.sprout_waitlist enable row level security; -- no policies: only the edge function reads/writes

create or replace function public.sprout_early_seconds() returns integer language sql immutable as $$ select 86400 $$;

-- Public totals only (no wallets, no X handles)
create or replace function public.sprout_waitlist_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', count(*),
    'early', count(*) filter (where up >= public.sprout_early_seconds())
  )
  from (
    select w.owner, coalesce(sum(n.uptime_seconds), 0) as up
    from public.sprout_waitlist w
    left join public.sprout_nodes n on n.owner = w.owner
    group by w.owner
  ) t;
$$;
revoke all on function public.sprout_waitlist_stats() from public;
grant execute on function public.sprout_waitlist_stats() to anon, authenticated, service_role;
