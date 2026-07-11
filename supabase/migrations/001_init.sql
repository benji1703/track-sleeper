-- Track Sleeper — initial schema
-- All access goes through the service-role key from the server; ownership scoping
-- (owner_email = session.user.email) is enforced in application code, not RLS.
-- RLS is enabled below as defense-in-depth with no policies, so any client using
-- the anon/public key is denied by default; only the service-role key (which
-- bypasses RLS) can read/write.

create extension if not exists pgcrypto;

create table if not exists babies (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  birth_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists babies_owner_email_idx on babies (owner_email);

create table if not exists sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  type text not null default 'nap' check (type in ('nap', 'night')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists sleep_sessions_baby_started_idx
  on sleep_sessions (baby_id, started_at desc);

alter table babies enable row level security;
alter table sleep_sessions enable row level security;
