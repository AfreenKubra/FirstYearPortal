-- ===========================================================================
-- 0019_vtu_scheme_and_live_roadmaps.sql
--
-- Three changes, all serving one product decision: a student's roadmap now
-- regenerates from their own profile and is visible immediately.
--
--   1. VTU scheme subjects, entered by an administrator. The portal does not
--      scrape vtu.ac.in — that is a stated non-goal (PRD section 2) — and the
--      generator must not invent subject names, which is the same rule that
--      keeps the resource catalogue honest. So subjects are data somebody
--      typed and can be held to, each carrying the official scheme URL it
--      came from.
--
--   2. A roadmap is visible to its student as soon as it exists. This
--      reverses the rule 0016 introduced. Mentor endorsement survives as an
--      additional state rather than a gate.
--
--   3. Department aggregates a student may read about their own cohort,
--      without being able to read anybody's individual record.
--
-- Requires 0018 (the 'auto' enum value).
-- ===========================================================================

-- --- 1. VTU scheme ----------------------------------------------------------

create table if not exists public.vtu_subjects (
  id              uuid primary key default gen_random_uuid(),

  department_code text not null references public.departments(code),
  semester        smallint not null check (semester between 1 and 8),

  -- The VTU subject code, e.g. BMATS101. Not parsed or validated beyond
  -- shape: the scheme changes, and a portal that rejects a real code because
  -- its pattern shifted is worse than one that accepts what the registrar
  -- typed.
  code            text not null check (length(trim(code)) between 2 and 20),
  name            text not null check (length(trim(name)) between 3 and 200),
  credits         smallint check (credits between 0 and 30),

  -- Which scheme year this row belongs to. VTU revises periodically and both
  -- versions coexist while cohorts overlap, so the year is part of the
  -- identity rather than something to overwrite.
  scheme_year     smallint not null check (scheme_year between 2000 and 2100),

  -- Where it was taken from. Required: an unsourced subject list is the
  -- fabricated metadata PRD 5.9 rules out, and this is the field that makes
  -- it checkable.
  official_url    text not null check (official_url ~* '^https?://'),

  -- Optional link to the domains this subject supports, so the roadmap can
  -- say "this maps to a domain you chose" rather than listing subjects
  -- generically.
  notes           text check (length(notes) <= 500),

  added_by        uuid references public.users(id) on delete set null,
  is_active       boolean not null default true,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (department_code, scheme_year, code)
);

create index vtu_subjects_scope_idx
  on public.vtu_subjects (department_code, semester, scheme_year, is_active);

create trigger vtu_subjects_touch_updated_at
  before update on public.vtu_subjects
  for each row execute function public.touch_updated_at();

create table if not exists public.vtu_subject_domains (
  subject_id uuid not null references public.vtu_subjects(id) on delete cascade,
  domain_id  integer not null references public.technical_domains(id) on delete cascade,
  primary key (subject_id, domain_id)
);

create index vtu_subject_domains_domain_idx
  on public.vtu_subject_domains (domain_id);

alter table public.vtu_subjects        enable row level security;
alter table public.vtu_subject_domains enable row level security;

-- Readable by any signed-in user: a student needs to see the subjects their
-- own roadmap cites.
create policy "read active vtu subjects" on public.vtu_subjects
  for select to authenticated using (is_active);

create policy "admin writes vtu subjects" on public.vtu_subjects
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read vtu subject domains" on public.vtu_subject_domains
  for select to authenticated using (true);

create policy "admin writes vtu subject domains" on public.vtu_subject_domains
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- 2. Roadmaps become live ------------------------------------------------

-- What the plan was generated from, so a read can tell whether the profile
-- has moved on without re-running the generator to find out.
alter table public.student_roadmaps
  add column if not exists inputs_fingerprint text;

create index if not exists student_roadmaps_fingerprint_idx
  on public.student_roadmaps (student_id, inputs_fingerprint);

/**
 * A student may now see their own roadmap whatever its state, bar the ones
 * that have been replaced.
 *
 * This replaces the 0016 policy, which required `approval_status =
 * 'approved'` and was the mechanism behind PRD section 2's promise that no
 * unreviewed plan reaches a student. That promise no longer holds, by
 * decision of the product owner, and the documentation has been changed to
 * say so rather than left claiming otherwise.
 *
 * 'superseded' stays hidden: it is the previous version of a plan the student
 * can already see, and showing both would present contradictory advice with
 * no way to tell which is current.
 */
drop policy if exists "student reads own approved roadmap" on public.student_roadmaps;

create policy "student reads own roadmap" on public.student_roadmaps
  for select to authenticated
  using (
    student_id = public.current_student_id()
    and approval_status <> 'superseded'
  );

-- A student may create their own roadmap now, because regeneration happens
-- on their own page view. The 0016 trigger still pins the review columns, so
-- they cannot mark it endorsed — `guard_roadmap_approval` forces a
-- non-reviewer's insert to 'draft'; the application writes 'auto' with the
-- service role, which is the same narrow use it already makes of it for
-- assessment scoring.
create policy "student creates own roadmap" on public.student_roadmaps
  for insert to authenticated
  with check (student_id = public.current_student_id());

-- Milestones follow: the 0016 read policy already keys off the roadmap being
-- visible, so widening the roadmap policy widens this too. The progress
-- policy still required 'approved', which would now leave a student unable to
-- tick off milestones on a live plan.
drop policy if exists "student updates own milestone progress" on public.roadmap_milestones;

create policy "student updates own milestone progress" on public.roadmap_milestones
  for update to authenticated
  using (exists (
    select 1 from public.student_roadmaps r
    where r.id = roadmap_milestones.roadmap_id
      and r.student_id = public.current_student_id()
      and r.approval_status <> 'superseded'
  ))
  with check (exists (
    select 1 from public.student_roadmaps r
    where r.id = roadmap_milestones.roadmap_id
      and r.student_id = public.current_student_id()
      and r.approval_status <> 'superseded'
  ));

create policy "student writes own milestones" on public.roadmap_milestones
  for insert to authenticated
  with check (exists (
    select 1 from public.student_roadmaps r
    where r.id = roadmap_milestones.roadmap_id
      and r.student_id = public.current_student_id()
  ));

-- --- 3. Department aggregates -----------------------------------------------

/**
 * Cohort figures a student may see about their own department.
 *
 * SECURITY DEFINER because a student cannot read another student's roadmap —
 * correctly — and this has to aggregate across all of them. What makes that
 * safe is the small-cohort guard: with fewer than five students carrying a
 * roadmap, an "average" is close enough to an individual's own figure to
 * identify them, so it returns nothing instead.
 *
 * Returns counts and averages only. No names, no ids, nothing that could be
 * joined back to a person. PRD section 2 is wary of turning development
 * tooling into ranking, and this is deliberately the weakest form of
 * comparison that still answers "am I unusual?".
 */
create or replace function public.department_roadmap_stats(p_department text)
returns table (
  cohort_size        integer,
  avg_completion     numeric,
  avg_milestones     numeric,
  students_with_plan integer
)
language sql
stable
security definer
set search_path = public
as $$
  with per_student as (
    select
      r.student_id,
      count(m.id) as total,
      count(m.completed_at) as done
    from public.student_roadmaps r
    join public.students s on s.id = r.student_id
    left join public.roadmap_milestones m on m.roadmap_id = r.id
    where s.department_code = p_department
      and r.approval_status <> 'superseded'
    group by r.student_id
  )
  select
    case when count(*) >= 5 then count(*)::integer end,
    case when count(*) >= 5
         then round(avg(case when total > 0 then done::numeric * 100 / total else 0 end), 1)
    end,
    case when count(*) >= 5 then round(avg(total), 1) end,
    case when count(*) >= 5 then count(*)::integer end
  from per_student;
$$;

grant execute on function public.department_roadmap_stats(text) to authenticated;
