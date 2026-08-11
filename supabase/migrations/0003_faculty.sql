-- ===========================================================================
-- 0003_faculty.sql — Faculty records, assignment scoping, and RLS
--
-- Covers PRD 5.5. This is the migration every other faculty-facing feature
-- waits on: assessments, events, achievement verification, and roadmap review
-- all need "which students may this faculty member see?" answered in one
-- place. ARCHITECTURE section 11 calls for exactly that — a single
-- `can_faculty_view_student()` reused across every policy, rather than the
-- join logic duplicated per table.
-- ===========================================================================

-- --- Faculty records --------------------------------------------------------

create table public.faculty (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  full_name       text not null,
  employee_code   text not null unique,
  email           text not null unique,
  phone           text not null,
  department_code text not null references public.departments(code),
  designation     text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index faculty_user_id_idx on public.faculty (user_id);
create index faculty_department_idx on public.faculty (department_code);

create trigger faculty_touch_updated_at
  before update on public.faculty
  for each row execute function public.touch_updated_at();

-- --- Assignments ------------------------------------------------------------
--
-- One table covers both ways a faculty member gets visibility:
--
--   * Scope rule  — department + optional semester + optional section.
--                   NULL means "any", so (CSE, NULL, NULL) is the whole
--                   department and (CSE, 1, 'A') is one section.
--   * Explicit    — a single named student, for mentoring groups that cut
--                   across sections.
--
-- `is_mentor` is separate from visibility on purpose: a department head may
-- need to see a student without being their mentor, and guardian contact is
-- gated on mentorship, not on visibility (PRD 5.5).

create table public.faculty_student_assignments (
  id              uuid primary key default gen_random_uuid(),
  faculty_id      uuid not null references public.faculty(id) on delete cascade,

  -- scope-rule columns
  department_code text references public.departments(code),
  semester        smallint check (semester between 1 and 2),
  section         text,

  -- explicit-student column
  student_id      uuid references public.students(id) on delete cascade,

  is_mentor       boolean not null default false,
  created_at      timestamptz not null default now(),

  -- An assignment must say *something*. Without this, a row of all-NULLs
  -- would read as "every student everywhere".
  constraint assignment_has_target check (
    student_id is not null or department_code is not null
  )
);

create index fsa_faculty_idx on public.faculty_student_assignments (faculty_id);
create index fsa_student_idx on public.faculty_student_assignments (student_id);
create index fsa_scope_idx
  on public.faculty_student_assignments (department_code, semester, section);

-- --- Mentoring notes --------------------------------------------------------

create table public.mentoring_notes (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  faculty_id uuid not null references public.faculty(id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now()
);

create index mentoring_notes_student_idx on public.mentoring_notes (student_id);

-- --- Scope resolution -------------------------------------------------------

-- The caller's own faculty row id, or NULL if they are not faculty.
-- SECURITY DEFINER because public.faculty has RLS that itself calls this.
create or replace function public.current_faculty_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id
  from public.faculty f
  join public.users u on u.id = f.user_id
  where f.user_id = auth.uid()
    and u.status = 'active';
$$;

/**
 * The single visibility predicate. Every faculty-scoped RLS policy in this
 * migration and in future ones must call this rather than re-deriving the
 * join — that is what keeps "who can see whom" answerable in one place.
 *
 * `p_mentor_only` narrows the same logic to mentorship, so guardian masking
 * and general visibility never drift apart.
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
  select exists (
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
  );
$$;

create or replace function public.is_assigned_mentor(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_faculty_view_student(p_student_id, true);
$$;

-- --- RLS --------------------------------------------------------------------

alter table public.faculty                     enable row level security;
alter table public.faculty_student_assignments enable row level security;
alter table public.mentoring_notes             enable row level security;

-- faculty: own row, plus admin-wide read.
create policy "own faculty row" on public.faculty
  for select to authenticated using (user_id = auth.uid());
create policy "insert own faculty row" on public.faculty
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own faculty row" on public.faculty
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin reads all faculty" on public.faculty
  for select to authenticated using (public.is_admin());

-- Assignments are readable by the faculty member they concern and by admins.
-- No insert/update/delete policy: only admins may create assignments, and
-- that flows through the service role until the admin UI (PRD 5.6) ships.
create policy "faculty reads own assignments" on public.faculty_student_assignments
  for select to authenticated using (faculty_id = public.current_faculty_id());
create policy "admin reads all assignments" on public.faculty_student_assignments
  for select to authenticated using (public.is_admin());

create policy "faculty reads own notes" on public.mentoring_notes
  for select to authenticated using (faculty_id = public.current_faculty_id());
create policy "faculty writes own notes" on public.mentoring_notes
  for insert to authenticated
  with check (
    faculty_id = public.current_faculty_id()
    and public.can_faculty_view_student(student_id)
  );
create policy "admin reads all notes" on public.mentoring_notes
  for select to authenticated using (public.is_admin());

-- --- Faculty read access to student data ------------------------------------
-- These are the policies 0001 deliberately left out until this table existed.

create policy "faculty reads assigned students" on public.students
  for select to authenticated
  using (public.can_faculty_view_student(id));

create policy "faculty reads assigned academic profiles"
  on public.student_academic_profiles
  for select to authenticated
  using (public.can_faculty_view_student(student_id));

create policy "faculty reads assigned interests" on public.student_interests
  for select to authenticated
  using (public.can_faculty_view_student(student_id));

create policy "faculty reads assigned goals" on public.student_goals
  for select to authenticated
  using (public.can_faculty_view_student(student_id));

create policy "faculty reads assigned domains" on public.student_domains
  for select to authenticated
  using (public.can_faculty_view_student(student_id));

create policy "faculty reads assigned languages" on public.student_languages
  for select to authenticated
  using (public.can_faculty_view_student(student_id));

-- --- Guardian masking -------------------------------------------------------
--
-- RLS controls which *rows* a faculty member sees; it cannot mask a column.
-- This view does that, and `security_invoker = true` is load-bearing: without
-- it the view would run as its owner and bypass the row policies above,
-- handing every faculty member the whole student table.
--
-- Guardian contact resolves to NULL unless the caller is the assigned mentor
-- or an admin — so the masking lives in the database, not only in the
-- application layer that reads it.

create view public.student_directory
with (security_invoker = true)
as
select
  s.id,
  s.user_id,
  s.full_name,
  s.usn,
  s.email,
  s.phone,
  s.dob,
  s.state,
  s.city,
  s.department_code,
  s.accommodation,
  s.profile_completion_percent,
  s.created_at,
  ap.tenth_percentage,
  ap.twelfth_percentage,
  ap.quota,
  ap.entrance_rank,
  ap.semester,
  ap.section,
  ap.admission_year,
  case when public.is_admin() or public.is_assigned_mentor(s.id)
       then s.guardian_name end as guardian_name,
  case when public.is_admin() or public.is_assigned_mentor(s.id)
       then s.guardian_phone end as guardian_phone,
  (public.is_admin() or public.is_assigned_mentor(s.id)) as guardian_visible
from public.students s
left join public.student_academic_profiles ap on ap.student_id = s.id;

grant select on public.student_directory to authenticated;
