create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies (id) on delete cascade,
  user_email text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_baby_idx on push_subscriptions (baby_id);
alter table push_subscriptions enable row level security;
