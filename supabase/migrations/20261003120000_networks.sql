-- License collections the node network accepts, one row per network (devnet beta, mainnet).
create table public.sprout_networks (
  collection text primary key,
  network text not null check (network in ('devnet', 'mainnet')),
  rpc_url text not null,
  label text,
  created_at timestamptz not null default now()
);
alter table public.sprout_networks enable row level security;
create policy "Anyone can read the accepted collections" on public.sprout_networks for select to anon, authenticated using (true);

insert into public.sprout_networks (collection, network, rpc_url, label)
select collection, 'devnet', rpc_url, 'Devnet beta'
from public.sprout_config where id = 1 and collection is not null;
