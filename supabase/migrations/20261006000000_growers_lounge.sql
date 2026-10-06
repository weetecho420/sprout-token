-- Growers Lounge: a group chat for Grower Node holders. All reads and writes go through
-- the sprout-node Edge Function (which checks the wallet's licenses), so no public policies.

create table public.sprout_admins (
  owner text primary key,          -- wallet address
  label text not null              -- shown as "<label> · Sprout team"
);
insert into public.sprout_admins (owner, label) values ('A3zBpkEH8XEuBEE8bFCsPi1SSJCtQAvZLtCKC919mzWG', 'Henry');

create table public.sprout_chat_messages (
  id bigint generated always as identity primary key,
  owner text not null,
  body text not null check (char_length(body) between 1 and 500),
  tier int not null default 0,     -- 1 Seedling … 5 Evergreen (highest the wallet holds), 0 unknown
  official boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index sprout_chat_messages_owner_idx on public.sprout_chat_messages (owner, created_at desc);

create table public.sprout_chat_reports (
  message_id bigint not null references public.sprout_chat_messages (id) on delete cascade,
  reporter text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter)
);

create table public.sprout_chat_bans (
  owner text primary key,
  banned_by text,
  created_at timestamptz not null default now()
);

alter table public.sprout_admins enable row level security;
alter table public.sprout_chat_messages enable row level security;
alter table public.sprout_chat_reports enable row level security;
alter table public.sprout_chat_bans enable row level security;
