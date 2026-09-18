-- ===========================================================================
-- 0045_subject_attendance.sql — class attendance per student per subject.
--
-- The portal had no class attendance at all; the only attendance it recorded
-- was for events (0014). This stores the two numbers a teacher actually keeps
-- — classes held and classes attended — rather than a percentage, because
-- an overall figure across subjects is only honest as total attended over
-- total held. Averaging per-subject percentages would weight a subject with
-- 12 classes the same as one with 50.
--
-- Filled from the same Google Sheet tab as the IA marks (see
-- lib/marks/sheet-import.ts), through the same preview-then-import step.
--
-- Unlike marks there is no release gate. A mark is a verdict a teacher
-- publishes when a whole column is ready; attendance is a running count a
-- student needs to see while there is still time to act on it. The preview
-- before import is the review step.
--
-- Who may write is exactly who may write marks: `can_edit_subject_marks`,
-- read here from the live database rather than restated, so the two tables
-- cannot drift into different answers to the same question.
-- ===========================================================================

create table public.student_subject_attendance (
  student_id       uuid not null references public.students(id)     on delete cascade,
  subject_id       uuid not null references public.vtu_subjects(id) on delete cascade,

  -- At least one class: before any class is held there is no percentage to
  -- show, and the import leaves such a row unwritten rather than storing 0/0.
  classes_held     smallint not null check (classes_held between 1 and 500),
  classes_attended smallint not null check (classes_attended >= 0),

  -- Who last wrote these figures. Pinned by the same trigger marks use.
  entered_by       uuid references public.faculty(id) on delete set null,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  primary key (student_id, subject_id),

  constraint attended_within_held check (classes_attended <= classes_held)
);

create index student_subject_attendance_subject_idx
  on public.student_subject_attendance (subject_id);

create trigger student_subject_attendance_touch_updated_at
  before update on public.student_subject_attendance
  for each row execute function public.touch_updated_at();

-- `marks_pin_author` only sets `entered_by` from the session, exempting the
-- trusted server — nothing in it is specific to marks.
create trigger student_subject_attendance_pin_author
  before insert or update on public.student_subject_attendance
  for each row execute function public.marks_pin_author();

alter table public.student_subject_attendance enable row level security;

create policy "student reads own attendance"
  on public.student_subject_attendance
  for select to authenticated
  using (student_id = public.current_student_id());

create policy "staff reads attendance of visible students"
  on public.student_subject_attendance
  for select to authenticated
  using (public.is_admin() or public.can_faculty_view_student(student_id));

create policy "subject teacher writes attendance"
  on public.student_subject_attendance
  for all to authenticated
  using (public.can_edit_subject_marks(subject_id, student_id))
  with check (public.can_edit_subject_marks(subject_id, student_id));
