-- ===========================================================================
-- 0031_psychometric_update_guard.sql — say the psychometric rule on UPDATE
-- too, instead of relying on SELECT to imply it.
--
-- Raised by CodeRabbit against 0013 during the retrospective review of the
-- August merge. The literal claim is correct: 0030 added the psychometric
-- guard to the SELECT policy on `assessment_attempts` and left the UPDATE
-- policy as `can_faculty_view_student(student_id)` alone, so on paper a
-- faculty member who is assigned to a student but is not their mentor could
-- write — and via RETURNING, read — a psychometric attempt.
--
-- IT IS NOT EXPLOITABLE TODAY, AND THAT WAS CHECKED RATHER THAN ASSUMED.
-- Postgres applies SELECT policies to the rows an UPDATE has to locate, so
-- with 0030 in place both of these already fail for such a caller:
--
--   update ... where id = $1 returning percentage   -> 0 rows
--   update ... where id = $1                        -> 0 rows, value unchanged
--
-- So this migration fixes no live hole. It is still worth applying, because
-- the protection is currently INCIDENTAL: it holds only because no SELECT
-- policy admits that caller. Anyone later adding a broader read policy — a
-- "staff read everything in their department" convenience, say — would remove
-- the guard from UPDATE without touching the UPDATE policy or being able to
-- see that they had. A rule that matters should be stated where it applies.
--
-- The `with check` clause carries it as well, so the row cannot be left in a
-- state the caller could not have written directly.
--
-- Requires 0030 (`is_psychometric_assessment`).
-- ===========================================================================

drop policy if exists "staff grades attempts of visible students"
  on public.assessment_attempts;

create policy "staff grades attempts of visible students" on public.assessment_attempts
  for update to authenticated
  using (
    public.can_faculty_view_student(student_id)
    and (
      not public.is_psychometric_assessment(assessment_id)
      or public.is_assigned_mentor(student_id)
    )
  )
  with check (
    public.can_faculty_view_student(student_id)
    and (
      not public.is_psychometric_assessment(assessment_id)
      or public.is_assigned_mentor(student_id)
    )
  );
