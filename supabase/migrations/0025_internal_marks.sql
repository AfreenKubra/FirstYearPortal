-- ===========================================================================
-- 0025_internal_marks.sql — faculty-entered internal marks (IA1, IA2,
-- assignment, activity) against the VTU scheme subjects from 0019.
--
-- This is deliberately NOT part of the assessment engine (0013). That engine
-- is built around a question bank and a student sitting an attempt; internal
-- marks are a number a faculty member types after marking a paper offline.
-- Modelling them as an `assessment` with a fake single-question `attempt`
-- would mean every auto-grading, availability, and attempt-state rule in 0013
-- had to grow an exception for rows that are not really attempts. One small
-- table costs less than that.
--
-- Two shapes were considered. The rejected one puts `ia1, ia2, assignment,
-- activity` as four columns on a single (student, subject) row: fewer rows,
-- simpler reads, and no pivot in the query layer. It was rejected because
--
--   * per-component release needs four `*_published_at` columns beside them,
--     and every future component doubles that, and
--   * the maximum mark differs by component and by subject kind (a lab's
--     split is not a theory paper's), so a fixed column set has to hardcode
--     the maxima somewhere the registrar cannot reach.
--
-- One row per component costs a pivot in `queries/marks.ts` — the same shape
-- as `attachDomains()` in `queries/vtu.ts` — and buys both of those back.
--
-- What this migration deliberately does NOT do: compute a CIE total. VTU's
-- formula varies by scheme and subject kind (best-of-IAs, scaling, lab
-- splits), so a column called `cie_total` would be the portal asserting an
-- official figure nobody entered. That is the same class of mistake the
-- roadmap generator is built to avoid, and the UI says "Sum of recorded
-- components" for the same reason. If the institution wants the official
-- calculation, it should arrive as scheme data somebody typed, not as
-- arithmetic this file guessed.
--
-- Requires 0019 (vtu_subjects) and 0020 (is_trusted_server).
-- ===========================================================================

-- --- 1. Which components exist ---------------------------------------------
--
-- A reference table rather than an enum, following the lookup-table reasoning
-- in ARCHITECTURE section 5.1: this must extend without a deploy. The enum
-- alternative is worse here than usual — migrations 0010 and 0018 exist
-- *solely* to add one enum value each, because Postgres will not let a new
-- value be used in the transaction that added it. A college adding "IA3"
-- should be a row, not that.

create table if not exists public.mark_components (
  code       text primary key check (code ~ '^[a-z0-9_]{2,20}$'),
  label      text not null check (length(trim(label)) between 1 and 60),

  -- The default ceiling for this component. Copied onto each marks row at
  -- write time rather than joined at read time — see `max_marks` below.
  max_marks  smallint not null check (max_marks between 1 and 200),

  sort_order smallint not null default 0,
  is_active  boolean not null default true
);

-- Seeded with what the institution actually uses today. Unlike the resource
-- catalogue (PRD 5.9), seeding these is not fabricated metadata: they are the
-- component names the college named in the request, carrying no claim about
-- an external source that could be wrong.
insert into public.mark_components (code, label, max_marks, sort_order) values
  ('ia1',        '1st IA',     20, 10),
  ('ia2',        '2nd IA',     20, 20),
  ('assignment', 'Assignment', 10, 30),
  ('activity',   'Activity',   10, 40)
on conflict (code) do nothing;

-- --- 2. The marks themselves ------------------------------------------------

create table if not exists public.student_subject_marks (
  student_id     uuid not null references public.students(id)     on delete cascade,
  subject_id     uuid not null references public.vtu_subjects(id) on delete cascade,
  component_code text not null references public.mark_components(code),

  -- Nullable on purpose: a row may exist as "this student was absent / not
  -- marked yet" without asserting a zero. A zero and a blank mean very
  -- different things on a marks card and must not collapse into each other.
  marks          numeric(5,2) check (marks >= 0),

  -- Snapshot of `mark_components.max_marks` at the time of entry, not a join.
  -- If an administrator later changes IA1 from 20 to 25, last semester's marks
  -- must not silently re-scale underneath the students who already saw them.
  max_marks      smallint not null check (max_marks between 1 and 200),

  remark         text check (length(remark) <= 300),

  -- Per-component release. Faculty enter a whole class, then release that
  -- column in one action; until then a student sees nothing rather than a
  -- half-entered column in which their own blank looks like a zero.
  published_at   timestamptz,

  -- Who last wrote this figure. Pinned by trigger below — a caller cannot
  -- attribute a mark to another member of staff.
  entered_by     uuid references public.faculty(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  primary key (student_id, subject_id, component_code),

  -- A mark above its own ceiling is a typo, and one that would quietly
  -- distort every sum built on it.
  constraint marks_within_max check (marks is null or marks <= max_marks)
);

-- The primary key already serves "one student's card". This covers the other
-- direction, which is how the faculty grid reads: everyone in one subject,
-- one component at a time.
create index if not exists student_subject_marks_subject_idx
  on public.student_subject_marks (subject_id, component_code);

create trigger student_subject_marks_touch_updated_at
  before update on public.student_subject_marks
  for each row execute function public.touch_updated_at();

-- --- 3. Authorship guard ----------------------------------------------------

/**
 * Pins `entered_by` to the calling member of staff.
 *
 * RLS already decides *whether* a caller may write this row; this decides
 * whose name ends up on it, which RLS cannot express. Without it a faculty
 * member could enter a mark and attribute it to a colleague — and since there
 * is no subject-teacher table yet (a deliberate scope decision, see
 * MANUAL-STEPS), `entered_by` plus the audit log is the whole of the
 * accountability story for who set a student's marks.
 *
 * The service role is exempt for the reason 0020 established: it is the
 * server acting deliberately, has no `current_faculty_id()`, and would
 * otherwise have its writes silently stripped of authorship.
 */
create or replace function public.marks_pin_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_server() then
    return new;
  end if;

  new.entered_by := public.current_faculty_id();
  return new;
end;
$$;

drop trigger if exists student_subject_marks_pin_author on public.student_subject_marks;
create trigger student_subject_marks_pin_author
  before insert or update on public.student_subject_marks
  for each row execute function public.marks_pin_author();

-- --- 4. RLS -----------------------------------------------------------------

alter table public.mark_components        enable row level security;
alter table public.student_subject_marks  enable row level security;

-- Component definitions are readable by anyone signed in: a student needs the
-- label and the ceiling to make sense of their own row.
drop policy if exists "read mark components" on public.mark_components;
create policy "read mark components" on public.mark_components
  for select to authenticated using (true);

drop policy if exists "admin writes mark components" on public.mark_components;
create policy "admin writes mark components" on public.mark_components
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/**
 * A student reads their own marks, and only after release.
 *
 * `published_at is not null` is the whole of the release gate. It is enforced
 * here rather than in the query layer because a student hitting the table
 * directly with the anon key must get the same answer as one loading the page
 * — the reason every other gate in this schema lives in RLS too.
 */
drop policy if exists "student reads own released marks" on public.student_subject_marks;
create policy "student reads own released marks" on public.student_subject_marks
  for select to authenticated
  using (
    published_at is not null
    and student_id in (
      select s.id from public.students s where s.user_id = auth.uid()
    )
  );

-- Staff read and write for students they can already see. One function, the
-- same one every other faculty-scoped policy calls, so mentor scope and HOD
-- department scope both fall out without being restated here (ARCHITECTURE
-- section 11). `is_admin()` is a separate branch because
-- `can_faculty_view_student` deliberately does not cover administrators.
drop policy if exists "staff reads marks of visible students" on public.student_subject_marks;
create policy "staff reads marks of visible students" on public.student_subject_marks
  for select to authenticated
  using (public.is_admin() or public.can_faculty_view_student(student_id));

drop policy if exists "staff writes marks of visible students" on public.student_subject_marks;
create policy "staff writes marks of visible students" on public.student_subject_marks
  for all to authenticated
  using (public.is_admin() or public.can_faculty_view_student(student_id))
  with check (public.is_admin() or public.can_faculty_view_student(student_id));
