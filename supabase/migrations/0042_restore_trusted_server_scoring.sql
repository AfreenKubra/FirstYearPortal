-- ===========================================================================
-- 0042_restore_trusted_server_scoring.sql — put back the exemption 0039
-- dropped.
--
-- 0039 needed to add five columns to `guard_attempt_scoring`'s pinned list,
-- and did it by restating the whole function. It restated the version from
-- 0013 — but 0020 had since amended that function to recognise the service
-- role via `is_trusted_server()`, and restating the old text silently
-- reverted it.
--
-- The consequence was not subtle. Marking runs server-side under the service
-- role, because a student's own session is (correctly) forbidden from writing
-- its own score. Without the exemption, that write hit the guard's UPDATE
-- branch and raised 'Only a mentor or an administrator can score an attempt.'
-- — so submitting a paper would fail, and no student could ever be marked.
--
-- It went unnoticed because there were no attempts in the database to try it
-- with. The RLS suite caught it the first time it ran afterwards.
--
-- The lesson is in `create or replace`: restating a function copies whatever
-- version you happened to read, and the one in the migration that first
-- created it is exactly the version most likely to be stale.
-- ===========================================================================

create or replace function public.guard_attempt_scoring()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_reviewer boolean;
begin
  -- `is_trusted_server()` restored from 0020, alongside 0039's columns.
  is_reviewer := public.is_trusted_server()
                 or public.is_admin()
                 or public.can_faculty_view_student(new.student_id);

  if not is_reviewer then
    if tg_op = 'INSERT' then
      new.status := 'in_progress';
      new.score := null;
      new.max_score := null;
      new.percentage := null;
      new.passed := null;
      new.graded_at := null;
      new.correct_count := null;
      new.wrong_count := null;
      new.unanswered_count := null;
      new.time_taken_seconds := null;
      new.integrity_status := null;
    else
      if new.score is distinct from old.score
         or new.max_score is distinct from old.max_score
         or new.percentage is distinct from old.percentage
         or new.passed is distinct from old.passed
         or new.graded_at is distinct from old.graded_at
         or new.correct_count is distinct from old.correct_count
         or new.wrong_count is distinct from old.wrong_count
         or new.unanswered_count is distinct from old.unanswered_count
         or new.time_taken_seconds is distinct from old.time_taken_seconds
         or new.integrity_status is distinct from old.integrity_status then
        raise exception 'Only a mentor or an administrator can score an attempt.';
      end if;

      if new.status is distinct from old.status
         and new.status not in ('submitted', 'abandoned') then
        raise exception 'A student may only submit or abandon their attempt.';
      end if;

      if old.status in ('submitted', 'graded') and new.status = 'in_progress' then
        raise exception 'A submitted attempt cannot be reopened.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- 0040's guard on external results was written the same way and has the same
-- gap. No application path hits it — a student records their own result and a
-- staff member rules on it, both under their own session — but a seed or
-- repair script running as the service role would be refused, and the rule
-- 0020 set out is that the service role is trusted here.
create or replace function public.guard_external_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_reviewer boolean;
begin
  if new.taken_on is not null and new.taken_on > current_date then
    raise exception 'A result cannot be dated in the future.';
  end if;

  is_reviewer := public.is_trusted_server()
                 or public.is_admin()
                 or public.can_faculty_view_student(new.student_id);

  if not is_reviewer then
    if tg_op = 'INSERT' then
      new.verification_status := 'self_reported';
      new.verified_by := null;
      new.verified_at := null;
      new.reviewer_note := null;
    else
      if new.verification_status is distinct from old.verification_status
         or new.verified_by is distinct from old.verified_by
         or new.verified_at is distinct from old.verified_at
         or new.reviewer_note is distinct from old.reviewer_note then
        raise exception 'Only a mentor or an administrator can verify a result.';
      end if;
    end if;
  end if;

  return new;
end;
$$;
