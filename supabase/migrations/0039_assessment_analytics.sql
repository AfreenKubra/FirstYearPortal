-- ===========================================================================
-- 0039_assessment_analytics.sql — skill categories, attempt counters,
-- and integrity signals.
--
-- The engine from 0013 already stores attempts, answers, scores, and attempt
-- numbers. Three things were missing before the assessment dashboard could be
-- built out of real rows rather than derived guesses:
--
--   1. Nothing said which of the six skill areas a paper belonged to, so a
--      "Logical Reasoning: 72%" card had no way to find its own attempts.
--
--   2. The per-attempt breakdown (correct / wrong / unanswered / time taken)
--      was recomputable from `student_answers`, but only by re-reading every
--      answer row of every attempt on every dashboard render. Storing it at
--      grading time is what makes the analytics table a single query.
--
--   3. Integrity signals had nowhere to live at all.
--
-- The counters are written by the grading path, never by the student, so they
-- are added to `guard_attempt_scoring`'s pinned-column list below. Leaving
-- them out of that list would have handed a student the ability to type
-- "correct: 25" onto their own attempt.
-- ===========================================================================

-- --- 1. Skill category ------------------------------------------------------

/**
 * Which of the six areas this paper measures.
 *
 * NULL means "not categorised" — a subject test a lecturer set for their own
 * class is a real assessment but not one of the six employability areas, and
 * must not be counted into a readiness figure that claims to be about them.
 */
alter table public.assessments
  add column skill_category text
    check (skill_category in (
      'aptitude', 'logical_reasoning', 'technical',
      'communication', 'soft_skills', 'personality'
    ));

create index assessments_skill_category_idx
  on public.assessments (skill_category)
  where skill_category is not null;

-- The portal now covers semesters 1-8; 0013 capped assessment audiences at 2,
-- which silently made it impossible to set a paper for anyone past first year.
-- Same defect, and same fix, as 0038 applied to `resources`.
alter table public.assessments
  drop constraint if exists assessments_semester_check;
alter table public.assessments
  add constraint assessments_semester_check
    check (semester is null or semester between 1 and 8);

-- --- 2. Attempt breakdown ---------------------------------------------------

create type public.integrity_status as enum ('low_risk', 'review_recommended');

alter table public.assessment_attempts
  add column correct_count      smallint check (correct_count >= 0),
  add column wrong_count        smallint check (wrong_count >= 0),
  add column unanswered_count   smallint check (unanswered_count >= 0),
  add column time_taken_seconds integer  check (time_taken_seconds >= 0),
  -- NULL means "not assessed", which is different from "low risk". An attempt
  -- sat before this migration existed has no signals either way, and must not
  -- be presented to faculty as having been cleared.
  add column integrity_status   public.integrity_status;

-- --- 3. Integrity events ----------------------------------------------------

/**
 * Client-reported signals from a sitting, one row per occurrence.
 *
 * These are weak evidence and the schema says so rather than leaving it to
 * the UI: there is no `is_cheating` column, and no signal here is conclusive.
 * A student on a flaky connection switches tabs; a student with a screen
 * reader leaves full screen. The events are recorded so a human can look, and
 * `integrity_status` tops out at 'review_recommended' for that reason.
 *
 * Inserted by the student's own browser during their own attempt, which also
 * means a determined student can simply not send them. That is understood and
 * is why absence of events is never itself treated as proof of anything.
 */
create table public.assessment_integrity_events (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.assessment_attempts(id) on delete cascade,
  event_type  text not null check (event_type in (
                'tab_hidden', 'tab_visible', 'fullscreen_exit', 'paste'
              )),
  occurred_at timestamptz not null default now()
);

create index integrity_events_attempt_idx
  on public.assessment_integrity_events (attempt_id, occurred_at);

alter table public.assessment_integrity_events enable row level security;

create policy "student records own attempt events"
  on public.assessment_integrity_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.assessment_attempts a
       where a.id = attempt_id
         and a.student_id = public.current_student_id()
         and a.status = 'in_progress'
    )
  );

create policy "student reads own attempt events"
  on public.assessment_integrity_events
  for select to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
       where a.id = attempt_id and a.student_id = public.current_student_id()
    )
  );

create policy "staff reads events of visible students"
  on public.assessment_integrity_events
  for select to authenticated
  using (
    exists (
      select 1 from public.assessment_attempts a
       where a.id = attempt_id
         and public.can_faculty_view_student(a.student_id)
    )
  );

create policy "admin reads all events"
  on public.assessment_integrity_events
  for select to authenticated
  using (public.is_admin());

-- --- 4. Extend the scoring guard -------------------------------------------

/**
 * Identical to 0013's version with the five new columns added to both the
 * INSERT blank-out and the UPDATE comparison.
 *
 * Restated in full rather than patched, so the complete list of things a
 * student may not write to their own attempt is readable in one place.
 */
create or replace function public.guard_attempt_scoring()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_reviewer boolean;
begin
  is_reviewer := public.is_admin() or public.can_faculty_view_student(new.student_id);

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
