-- ===========================================================================
-- 0026_subject_faculty.sql — who teaches what, and therefore who may mark it.
--
-- Closes the gap 0025 shipped with and MANUAL-STEPS recorded: any member of
-- staff who could see a student could edit that student's marks for any
-- subject, with `entered_by` and the audit log as the only accountability.
-- A marks sheet that anyone in the department can rewrite is not a marks
-- sheet, so this narrows the write to the person who actually taught the
-- paper.
--
-- WHO MAY EDIT MARKS AFTER THIS
--
--   * the faculty member assigned to that subject (optionally narrowed to one
--     section), and
--   * the head of that subject's department, and
--   * an administrator.
--
-- A plain mentor may no longer edit marks for a subject they do not teach,
-- which is the point of the change.
--
-- The HOD and administrator branches are deliberate rather than oversights.
-- Without them a subject with no `subject_faculty` row would be uneditable by
-- anybody, and the portal would have shipped the same trap
-- `faculty_student_assignments` already has — a screen that is empty for a
-- reason nobody can guess from looking at it. Somebody accountable can always
-- enter marks, and that somebody is who assigns the teacher.
--
-- WHAT THIS ALSO WIDENS, ON PURPOSE
--
-- A subject teacher who is nobody's mentor could not previously see the
-- students they teach at all — `can_faculty_view_student()` knew only about
-- mentor assignments and HOD departments — so restricting marks to teachers
-- without this would have produced a grid that is always empty for exactly
-- the person it is meant for. Rather than a second visibility path beside it,
-- this adds a branch to that one function, which is what ARCHITECTURE
-- section 11 asks of any new staff relationship.
--
-- That branch deliberately fails `p_mentor_only`, so guardian contact stays
-- masked: teaching somebody is not the same as being accountable for ringing
-- their home, and only the mentor, the HOD, and administrators keep that.
--
-- Requires 0019 (vtu_subjects) and 0025 (student_subject_marks).
-- ===========================================================================

create table if not exists public.subject_faculty (
  subject_id uuid not null references public.vtu_subjects(id) on delete cascade,
  faculty_id uuid not null references public.faculty(id)      on delete cascade,

  -- NULL means every section, matching the convention
  -- `faculty_student_assignments` established: a NULL scope column reads as
  -- "any". Several teachers may share a subject across sections, which is why
  -- the section is part of the identity rather than a column to overwrite.
  section    text check (section is null or length(trim(section)) between 1 and 4),

  assigned_by uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),

  -- A surrogate key, NOT `primary key (subject_id, faculty_id, section)`.
  -- Postgres makes every primary-key column implicitly NOT NULL, which would
  -- have made the "NULL means every section" row above impossible to insert —
  -- and silently so, since the failure looks like an ordinary constraint
  -- violation rather than a design contradiction. The two partial unique
  -- indexes below restore the uniqueness the composite key was there for.
  id uuid primary key default gen_random_uuid()
);

-- Uniqueness, split by whether a section is named. `unique (…, section)` alone
-- would not do it: SQL treats NULLs as distinct, so one teacher could be
-- assigned to "all sections" of the same subject any number of times.
create unique index if not exists subject_faculty_all_sections_idx
  on public.subject_faculty (subject_id, faculty_id)
  where section is null;

create unique index if not exists subject_faculty_section_idx
  on public.subject_faculty (subject_id, faculty_id, section)
  where section is not null;

-- The policies below look up by faculty first ("what may I mark?"), which
-- neither index above serves.
create index if not exists subject_faculty_faculty_idx
  on public.subject_faculty (faculty_id);

/**
 * Extends the single visibility predicate with a subject-teacher branch.
 *
 * The body is otherwise unchanged from 0011. The new branch matches a student
 * against the subjects the caller teaches, on department, semester, and — if
 * the assignment names one — section.
 *
 * `and not p_mentor_only` is what keeps guardian masking intact: this branch
 * can grant sight of a student, never of their guardian's phone number.
 */
create or replace function public.can_faculty_view_student(
  p_student_id uuid,
  p_mentor_only boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.students s
      where s.id = p_student_id
        and s.department_code = public.current_hod_department()
    )
    or exists (
      select 1
      from public.faculty_student_assignments a
      left join public.students s on s.id = p_student_id
      left join public.student_academic_profiles ap on ap.student_id = s.id
      where a.faculty_id = public.current_faculty_id()
        and (not p_mentor_only or a.is_mentor)
        and (
          -- explicit assignment
          a.student_id = p_student_id
          or (
            -- scope rule; NULL in a scope column means "any"
            a.student_id is null
            and a.department_code = s.department_code
            and (a.semester is null or a.semester = ap.semester)
            and (a.section  is null or a.section  = ap.section)
          )
        )
    )
    or (
      -- Subject teacher (0026). Never satisfies p_mentor_only.
      not p_mentor_only
      and exists (
        select 1
        from public.subject_faculty sf
        join public.vtu_subjects vs on vs.id = sf.subject_id
        join public.students s on s.id = p_student_id
        left join public.student_academic_profiles ap on ap.student_id = s.id
        where sf.faculty_id = public.current_faculty_id()
          and vs.department_code = s.department_code
          and vs.semester = ap.semester
          and (sf.section is null or sf.section = ap.section)
      )
    );
$$;

/**
 * May the caller edit this student's marks for this subject?
 *
 * Separate from `can_faculty_view_student()` because seeing and marking are
 * now different questions: a mentor sees a student's card and may not touch
 * it, while a subject teacher marks a class they may not otherwise mentor.
 * Collapsing the two back together is what this migration exists to undo.
 */
create or replace function public.can_edit_subject_marks(
  p_subject_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.vtu_subjects vs
      where vs.id = p_subject_id
        and vs.department_code = public.current_hod_department()
    )
    or exists (
      select 1
      from public.subject_faculty sf
      left join public.student_academic_profiles ap on ap.student_id = p_student_id
      where sf.subject_id = p_subject_id
        and sf.faculty_id = public.current_faculty_id()
        and (sf.section is null or sf.section = ap.section)
    );
$$;

/**
 * The subjects the caller may mark, without naming a student.
 *
 * `can_edit_subject_marks()` needs a student because a section-scoped
 * assignment is only meaningful against one; the subject picker has no
 * student yet and only needs to know which subjects are worth offering.
 * Offering one the caller cannot save would be a grid that refuses every
 * write with no way to tell why from the screen.
 */
create or replace function public.my_markable_subject_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select vs.id
  from public.vtu_subjects vs
  where vs.is_active
    and (
      public.is_admin()
      or vs.department_code = public.current_hod_department()
      or exists (
        select 1
        from public.subject_faculty sf
        where sf.subject_id = vs.id
          and sf.faculty_id = public.current_faculty_id()
      )
    );
$$;

-- --- Marks write policy, narrowed ------------------------------------------
--
-- The read policy is untouched: staff who can see a student may still read
-- their marks, which is what lets a mentor discuss results they cannot edit.

drop policy if exists "staff writes marks of visible students" on public.student_subject_marks;

create policy "subject teacher writes marks" on public.student_subject_marks
  for all to authenticated
  using (public.can_edit_subject_marks(subject_id, student_id))
  with check (public.can_edit_subject_marks(subject_id, student_id));

-- --- subject_faculty RLS ----------------------------------------------------

alter table public.subject_faculty enable row level security;

-- Readable by any signed-in staff member: the marks screen has to be able to
-- say who is down to teach a subject, and a student seeing their own teacher
-- is not a disclosure.
drop policy if exists "read subject faculty" on public.subject_faculty;
create policy "read subject faculty" on public.subject_faculty
  for select to authenticated using (true);

-- Assigned by an administrator, or by the head of the subject's own
-- department — who is the person that actually knows the timetable.
drop policy if exists "admin or hod assigns subject faculty" on public.subject_faculty;
create policy "admin or hod assigns subject faculty" on public.subject_faculty
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.vtu_subjects vs
      where vs.id = subject_faculty.subject_id
        and vs.department_code = public.current_hod_department()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.vtu_subjects vs
      where vs.id = subject_faculty.subject_id
        and vs.department_code = public.current_hod_department()
    )
  );
