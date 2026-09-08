-- ===========================================================================
-- 0041_assessment_semester_range.sql — an assessment spans a range of
-- semesters, not one.
--
-- 0013 gave `assessments` a single `semester`, which cannot express the most
-- ordinary audience there is: "first year", meaning semesters 1 and 2. The
-- only ways round it were both bad. Setting semester = 1 works until the
-- cohort moves to semester 2, at which point the paper silently leaves their
-- page — no error, it simply stops matching, which is the kind of failure
-- nobody notices until a student asks where their assessments went. Creating
-- a second copy of the paper for semester 2 splits one area's attempts across
-- two rows, so "best score" and "attempts" on the dashboard would each be
-- computed from half the truth.
--
-- So the column is replaced rather than supplemented. Keeping both a
-- `semester` and a range would be two sources of truth for one question, and
-- the pair would eventually disagree.
--
-- NULL still means "any semester", the convention every scope column in this
-- schema uses. The two bounds are given together or not at all.
-- ===========================================================================

alter table public.assessments
  add column semester_min smallint check (semester_min between 1 and 8),
  add column semester_max smallint check (semester_max between 1 and 8);

-- Carry every existing audience across unchanged: a paper set to semester 3
-- becomes the range 3-3, which targets exactly who it targeted before.
update public.assessments
   set semester_min = semester,
       semester_max = semester
 where semester is not null;

alter table public.assessments
  add constraint assessments_semester_range check (
    (semester_min is null and semester_max is null)
    or (
      semester_min is not null
      and semester_max is not null
      and semester_min <= semester_max
    )
  );

-- The index carried the old column.
drop index if exists public.assessments_scope_idx;
create index assessments_scope_idx
  on public.assessments (department_code, semester_min, semester_max, section);

alter table public.assessments drop column semester;

/**
 * Rewritten for the range.
 *
 * `between` preserves the previous behaviour for a student whose academic
 * profile has no semester recorded: comparing NULL yields NULL, which is not
 * true, so they fall outside any paper that names a semester — exactly as
 * they did under `a.semester = ap.semester`. A student with no semester on
 * file is not silently swept into every audience.
 *
 * This function is what the RLS policy on `assessments` reads, so it is also
 * what decides whether a paper is visible at all. `security definer` and the
 * pinned `search_path` are carried over from 0013 for that reason.
 */
create or replace function public.assessment_targets_student(
  p_assessment_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessments a
    join public.students s on s.id = p_student_id
    left join public.student_academic_profiles ap on ap.student_id = s.id
    where a.id = p_assessment_id
      and (a.department_code is null or a.department_code = s.department_code)
      and (
        a.semester_min is null
        or ap.semester between a.semester_min and a.semester_max
      )
      and (a.section is null or a.section = ap.section)
  );
$$;
