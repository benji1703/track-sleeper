-- Normalize email casing at the DB level: application code lowercases all
-- emails at the boundary; these backstops guarantee one baby per mailbox
-- regardless of casing and fold any pre-existing rows.

update babies set owner_email = lower(owner_email);
update baby_caregivers set email = lower(email), invited_by = lower(invited_by);

create unique index if not exists babies_owner_email_lower_uidx
  on babies (lower(owner_email));
