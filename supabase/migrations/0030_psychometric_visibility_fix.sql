-- ===========================================================================
-- 0030_psychometric_visibility_fix.sql — the psychometric restriction was
-- failing open.
--
-- PRD 5.7 states that a psychometric result reaches the student and their
-- assigned mentor and nobody else, and calls that a product requirement
-- rather than optional copy. 0013's policy intended exactly that:
--
--   using (
--     public.can_faculty_view_student(student_id)
--     and (
--       not exists (
--         select 1 from public.assessments a
--         where a.id = assessment_attempts.assessment_id
--           and a.kind = 'psychometric'
--       )
--       or public.is_assigned_mentor(student_id)
--     )
--   )
--
-- A subquery inside an RLS policy runs with the CALLER's privileges, so it is
-- itself filtered by RLS on the table it reads. `assessments` is only visible
-- to its author, the head of that department, an administrator, and targeted
-- students — so for any other member of staff that inner select returns no
-- rows, `exists` is false, `not exists` is TRUE, and the psychometric branch
-- is skipped entirely.
--
-- The effect: a faculty member assigned to a student but deliberately NOT
-- their mentor could read that student's psychometric attempt, provided they
-- did not author the paper — which is the ordinary case. The guard failed in
-- the permissive direction for precisely the people it was written to stop.
--
-- Negation is what made it dangerous. `exists` over a table the caller cannot
-- read fails closed; `not exists` fails open. The same pattern in
-- `student_answers` uses a join and therefore denies instead — safe, but
-- wrong in the other direction: a genuine mentor who cannot read the
-- assessment row is refused answers they are entitled to. Both are fixed here
-- by asking a function that is not subject to RLS at all.
--
-- Found by tests/rls/modules.rls.test.ts. The first version of that test used
-- a staff member with no relationship to the student, which passes whether or
-- not the branch works, because `can_faculty_view_student` already refuses
-- them. Giving the fixture an assignment with is_mentor = false is what made
-- the assertion meaningful, and it failed immediately.
-- ===========================================================================

/**
 * Is this assessment psychometric?
 *
 * SECURITY DEFINER so the answer does not depend on whether the caller may
 * read the assessment — which is the whole defect above. It discloses one
 * boolean about a row the caller already holds an id for, and that boolean is
 * what decides whether they are allowed to see anything further.
 */
create or replace function public.is_psychometric_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessments a
    where a.id = p_assessment_id
      and a.kind = 'psychometric'
  );
$$;

-- --- assessment_attempts ----------------------------------------------------

drop policy if exists "staff reads attempts of visible students"
  on public.assessment_attempts;

create policy "staff reads attempts of visible students" on public.assessment_attempts
  for select to authenticated
  using (
    public.can_faculty_view_student(student_id)
    and (
      not public.is_psychometric_assessment(assessment_id)
      or public.is_assigned_mentor(student_id)
    )
  );

-- --- student_answers --------------------------------------------------------
--
-- Rewritten to ask the same function rather than joining `assessments`. The
-- join made a mentor's access depend on their being able to read the paper
-- itself, so the honest fix is the same one.

drop policy if exists "staff reads answers of visible students"
  on public.student_answers;

create policy "staff reads answers of visible students" on public.student_answers
  for select to authenticated
  using (exists (
    select 1
    from public.assessment_attempts at
    where at.id = student_answers.attempt_id
      and public.can_faculty_view_student(at.student_id)
      and (
        not public.is_psychometric_assessment(at.assessment_id)
        or public.is_assigned_mentor(at.student_id)
      )
  ));
