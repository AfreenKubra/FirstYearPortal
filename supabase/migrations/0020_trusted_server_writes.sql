-- ===========================================================================
-- 0020_trusted_server_writes.sql — let trusted server code past the guards
--
-- The guards added in 0009, 0013, and 0016 all ask the same question: "is the
-- caller a reviewer?", answered as `is_admin() or can_faculty_view_student()`.
-- Both are false when there is no session, which is exactly the case for the
-- service role — so trusted server code was being treated as the one actor
-- the guards exist to stop.
--
-- That is not theoretical. It broke two shipped paths:
--
--   * Roadmap regeneration could not mark the previous version superseded
--     ("Only a mentor or an administrator can review a roadmap"), and its
--     insert was silently rewritten from 'auto' to 'draft'.
--
--   * Assessment submission writes the auto-marked score with the service
--     role, because the student's own session correctly cannot. The same
--     guard would reject it.
--
-- The fix is to recognise the service role rather than to weaken the rule.
-- `auth.uid()` is NULL only for the service role here: an unauthenticated
-- caller never reaches these tables, because RLS denies them before any
-- trigger runs. So the exemption cannot be reached by a browser session.
--
-- Guards on *student* self-service — a student rewording a milestone, forging
-- a notification, marking their own attendance — are untouched.
-- ===========================================================================

/** True for trusted server-side callers holding the service role. */
create or replace function public.is_trusted_server()
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.uid() is null
      or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '')
         = 'service_role';
$$;

-- --- Roadmaps ---------------------------------------------------------------

create or replace function public.guard_roadmap_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_reviewer boolean;
begin
  is_reviewer := public.is_trusted_server()
                 or public.is_admin()
                 or public.can_faculty_view_student(new.student_id);

  if not is_reviewer then
    if tg_op = 'INSERT' then
      new.approval_status := 'draft';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.mentor_remarks := null;
    elsif new.approval_status is distinct from old.approval_status
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.mentor_remarks is distinct from old.mentor_remarks then
      raise exception 'Only a mentor or an administrator can review a roadmap.';
    end if;
  end if;

  return new;
end;
$$;

-- --- Assessment attempts ----------------------------------------------------

create or replace function public.guard_attempt_scoring()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_reviewer boolean;
begin
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
    else
      if new.score is distinct from old.score
         or new.max_score is distinct from old.max_score
         or new.percentage is distinct from old.percentage
         or new.passed is distinct from old.passed
         or new.graded_at is distinct from old.graded_at then
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

-- --- Answer grading ---------------------------------------------------------

create or replace function public.guard_answer_grading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id    uuid;
  is_reviewer boolean;
begin
  select at.student_id into owner_id
    from public.assessment_attempts at
   where at.id = new.attempt_id;

  is_reviewer := public.is_trusted_server()
                 or public.is_admin()
                 or public.can_faculty_view_student(owner_id);

  if not is_reviewer then
    if tg_op = 'INSERT' then
      new.awarded_points := null;
      new.graded_by := null;
      new.graded_at := null;
      new.grader_remarks := null;
    else
      if new.awarded_points is distinct from old.awarded_points
         or new.graded_by is distinct from old.graded_by
         or new.graded_at is distinct from old.graded_at
         or new.grader_remarks is distinct from old.grader_remarks then
        raise exception 'Only a mentor or an administrator can grade an answer.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- --- Answers frozen after submission ----------------------------------------
-- Same reason: the auto-marking pass writes answer scores after the attempt
-- has moved to 'submitted'.

create or replace function public.guard_answer_after_submit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.attempt_status;
  owner_id       uuid;
begin
  select at.status, at.student_id into current_status, owner_id
    from public.assessment_attempts at
   where at.id = coalesce(new.attempt_id, old.attempt_id);

  if current_status <> 'in_progress'
     and not (
       public.is_trusted_server()
       or public.is_admin()
       or public.can_faculty_view_student(owner_id)
     )
  then
    raise exception 'This attempt has been submitted and can no longer be changed.';
  end if;

  return coalesce(new, old);
end;
$$;
