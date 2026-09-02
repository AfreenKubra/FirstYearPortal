-- ===========================================================================
-- 0023_resource_dates.sql — when a dated resource actually happens (PRD 5.9)
--
-- Migration 0021 added 'exam' and 'workshop' to `resource_kind`, but a
-- catalogue entry had nowhere to record *when* the thing occurs. A student who
-- has chosen "GATE / Higher studies in India" needs the date more than they
-- need the link, and until now the portal had no honest way to show it.
--
-- Why these dates live on `resources` rather than on `events`:
--
--   * `events` rows are published by a faculty member and are visible only to
--     a matching department + semester + section (`event_targets_student`).
--     A national exam scoped that way would be invisible to most of the people
--     it applies to.
--   * `events` carries capacity, waitlist, registration and attendance
--     machinery, none of which means anything for an external exam.
--   * `resources` is already admin-verified and already tagged by career goal
--     via `resource_goals`, which is exactly the join needed to answer "when
--     is the exam for the goal this student picked?".
--
-- College-run sessions still belong in `events` — 0024 makes those taggable so
-- the two sources complement each other rather than compete.
--
-- All three columns are nullable, and deliberately so. Most resources are
-- courses that simply have no date, and a NOT NULL column would push whoever
-- is curating toward inventing one — the precise failure `0015_resources.sql`
-- was written to avoid. A missing date renders as absent, never as a guess.
--
-- `date`, not `timestamptz`: an exam is a calendar day, not an instant. A
-- timestamp would invite a fabricated time-of-day and a timezone that nobody
-- verified, which is false precision dressed up as rigour.
-- ===========================================================================

alter table public.resources
  add column if not exists occurs_on              date,
  add column if not exists registration_opens_on  date,
  add column if not exists registration_closes_on date;

-- Dates that contradict each other are a data-entry error, not a state the
-- UI should have to render. Each clause tolerates NULLs so a partially-known
-- schedule (an exam date with no announced registration window, say) is still
-- recordable.
alter table public.resources
  drop constraint if exists resource_dates_ordered;

alter table public.resources
  add constraint resource_dates_ordered check (
    (registration_opens_on is null
      or registration_closes_on is null
      or registration_opens_on <= registration_closes_on)
    and
    (registration_closes_on is null
      or occurs_on is null
      or registration_closes_on <= occurs_on)
  );

-- Partial: only dated rows are ever ordered by this, and they are a small
-- minority of the catalogue.
create index if not exists resources_occurs_on_idx
  on public.resources (occurs_on)
  where occurs_on is not null;

comment on column public.resources.occurs_on is
  'Calendar day the exam/workshop happens. NULL for undated resources such as courses.';
comment on column public.resources.registration_opens_on is
  'First day registration is open. NULL when unknown or not applicable.';
comment on column public.resources.registration_closes_on is
  'Last day registration is accepted. NULL when unknown or not applicable.';
