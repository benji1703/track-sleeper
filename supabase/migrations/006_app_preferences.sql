create table if not exists app_preferences (
  baby_id uuid not null references babies (id) on delete cascade,
  user_email text not null,
  appearance text not null default 'automatic' check (appearance in ('automatic', 'light', 'dark')),
  ai_coach_enabled boolean not null default false,
  caregiver_updates_enabled boolean not null default false,
  sleep_window_reminders_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (baby_id, user_email)
);

alter table app_preferences enable row level security;
