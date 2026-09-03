-- ===========================================================================
-- 0028_marks_released_notification.sql — tell a student when their marks
-- become visible.
--
-- Marks are the one thing in this portal a student actively waits for, and
-- the release gate (0025) means the moment they appear is decided by somebody
-- else, invisibly. Without this the only way to find out is to keep opening
-- the page. That is precisely the case 0017 says a notification is for: an
-- event the person cannot discover by looking.
--
-- Raised by a trigger rather than from `releaseComponent`, following 0017's
-- rule — a notification attached to the row change cannot be forgotten by a
-- new code path, and `notifications` has no INSERT policy, so a session can
-- neither forge one nor suppress one about itself.
--
-- ON FAN-OUT. Releasing a component for a class writes one notification per
-- student — around 30 to 60 rows for one click. That is deliberate and it is
-- not the case MANUAL-STEPS defers: this is one message per person about
-- their own marks, not a broadcast of the same announcement to a whole
-- department. The row count is bounded by the class the teacher just marked,
-- and each row is addressed to exactly the person it concerns.
--
-- Requires 0027 (the enum value) and 0025 (student_subject_marks).
-- ===========================================================================

/**
 * Fires when a component becomes visible to a student, and only then.
 *
 * The guard is narrow on purpose. `student_subject_marks` is updated whenever
 * a teacher edits a figure, so notifying on any update would tell a student
 * about every correction and typo fix. Only the null → not-null transition on
 * `published_at` is a release; re-releasing something already released, or
 * withdrawing it, says nothing.
 *
 * A withdrawal is deliberately silent. Telling somebody their marks have been
 * taken away, with no explanation the portal can offer, is worse than the
 * page quietly showing a dash again — and a withdrawal is nearly always a
 * teacher correcting their own mistake within a few minutes.
 *
 * A row with no mark recorded is skipped too: "your marks are available" is
 * false when the cell is blank.
 */
create or replace function public.notify_marks_released()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_code text;
  v_component_label text;
begin
  if new.published_at is null or old.published_at is not null then
    return new;
  end if;

  if new.marks is null then
    return new;
  end if;

  select code into v_subject_code
  from public.vtu_subjects where id = new.subject_id;

  select label into v_component_label
  from public.mark_components where code = new.component_code;

  perform public.notify_user(
    public.user_id_for_student(new.student_id),
    'marks_released',
    format(
      '%s marks released',
      coalesce(v_component_label, new.component_code)
    ),
    -- States the figure rather than making them open the page to find it,
    -- and names the subject, since several are released around the same time.
    format(
      'You scored %s out of %s in %s.',
      -- `FM` drops trailing zeros but leaves the decimal separator behind, so
      -- a whole mark formats as "15." — the rtrim is what makes 15.00 read as
      -- "15" while 17.50 still reads as "17.5".
      rtrim(to_char(new.marks, 'FM999999990.99'), '.'),
      new.max_marks,
      coalesce(v_subject_code, 'your subject')
    ),
    '/assessments',
    'student_subject_marks',
    new.student_id::text || ':' || new.subject_id::text || ':' || new.component_code
  );

  return new;
end;
$$;

drop trigger if exists marks_notify_released on public.student_subject_marks;
create trigger marks_notify_released
  after update on public.student_subject_marks
  for each row execute function public.notify_marks_released();
