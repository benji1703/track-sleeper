-- Track Sleeper — baby sharing (caregivers)
-- Caregivers get access to a baby's sessions via email match; scoping is
-- enforced in application code (see lib/babyAccess.ts), same as 001_init.sql.

create table if not exists baby_caregivers (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies (id) on delete cascade,
  email text not null,
  invited_by text not null,
  created_at timestamptz not null default now(),
  unique (baby_id, email)
);

create index if not exists baby_caregivers_email_idx on baby_caregivers (email);

alter table baby_caregivers enable row level security;
