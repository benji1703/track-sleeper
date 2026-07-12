-- Guarantee the core tracker invariants even when multiple Vercel instances or
-- caregivers write concurrently. The API checks remain for friendly errors.

create unique index if not exists sleep_sessions_one_open_per_baby_uidx
  on sleep_sessions (baby_id)
  where ended_at is null;

alter table sleep_sessions
  add constraint sleep_sessions_time_order_check
  check (ended_at is null or ended_at > started_at)
  not valid;
