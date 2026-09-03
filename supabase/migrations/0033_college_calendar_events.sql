/**
 * The official college calendar — holidays, exam windows, IA dates,
 * parent-teacher meetings, semester milestones, timetable changes.
 *
 * Distinct from `events` (migration 0014): `events` is something a faculty
 * member publishes and a student registers for, scoped to one department/
 * semester/section and carrying capacity. This is the institution's own
 * academic calendar — nobody registers for Ganesh Chaturthi — so there is no
 * registration machinery here, only a date (or date range), a category, and
 * who it applies to. Read access is everyone signed in; write access is
 * administrators only, per the same `is_admin()` gate `vtu_subjects` uses,
 * and for the same reason: an official calendar a student could edit would
 * not be one they could trust.
 */

create type public.calendar_event_category as enum (
  'holiday', 'exam', 'ptm', 'academic', 'deadline', 'timetable'
);

create table public.college_calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) between 2 and 200),
  description text check (length(description) <= 1000),
  category    public.calendar_event_category not null,

  starts_on   date not null,
  -- Null for a single day; set for a range (e.g. a four-day IA window).
  ends_on     date,

  -- Null means every semester. VTU semesters run 1-8; this portal currently
  -- only carries first-year (1-2) students, so a row scoped to semester 3 or
  -- 5 is real data that simply has nobody to show it to yet — not an error.
  semester    smallint check (semester between 1 and 8),

  -- Marks a row for the dashboard's "Important Academic Dates" widget — a
  -- handful of landmarks (semester start, IA windows, last working day) out
  -- of what is otherwise a long list. A boolean an admin sets explicitly,
  -- rather than the widget pattern-matching titles like "Commencement" or
  -- "Last Working Day", which would silently stop working the day someone
  -- phrases a title differently.
  is_key_date boolean not null default false,

  created_by  uuid references public.admins(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint calendar_event_range_ordered check (ends_on is null or ends_on >= starts_on)
);

create index college_calendar_events_starts_on_idx
  on public.college_calendar_events (starts_on);

alter table public.college_calendar_events enable row level security;

create policy "read calendar events" on public.college_calendar_events
  for select
  using (auth.uid() is not null);

create policy "admin writes calendar events" on public.college_calendar_events
  for all
  using (public.is_admin())
  with check (public.is_admin());
