-- Idempotent, attributable writes for offline replay and caregiver races.
alter table sleep_sessions add column if not exists created_by text;
alter table sleep_sessions add column if not exists updated_by text;
alter table sleep_sessions add column if not exists revision integer not null default 1;
alter table sleep_sessions add column if not exists source text not null default 'web';

create table if not exists sleep_mutations (
  id uuid primary key default gen_random_uuid(),
  mutation_id uuid not null,
  baby_id uuid not null references babies (id) on delete cascade,
  actor_email text not null,
  action text not null check (action in ('start', 'stop')),
  session_id uuid references sleep_sessions (id) on delete set null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (baby_id, mutation_id)
);

create index if not exists sleep_mutations_baby_created_idx
  on sleep_mutations (baby_id, created_at desc);

alter table sleep_mutations enable row level security;
