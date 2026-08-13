-- ===========================================================================
-- 0011_hod_scope_and_admin_allowlist.sql
--
-- Two related changes to who can see what:
--
--   1. Heads of Department become a first-class role. A HOD sees every
--      student in their own department without needing an assignment row,
--      which is the difference between them and a faculty mentor.
--
--   2. The `admin` role becomes allow-list-only. Administrator is the one
--      role with institution-wide reach, and until now anything could reach
--      it: `handle_new_auth_user` takes the role straight from signup
--      metadata, so a stranger could register asking for `role: 'admin'` and
--      sit in the approvals queue looking like a legitimate request.
--
-- Requires 0010 to have been applied first — it adds the 'hod' enum value,
-- and PostgreSQL will not let one transaction both add an enum value and use
-- it.
-- ===========================================================================

-- --- 1. Administrator allow-list --------------------------------------------

create table if not exists public.admin_allowlist (
  email     text primary key,
  note      text,
  added_at  timestamptz not null default now()
);

comment on table public.admin_allowlist is
  'The only email addresses permitted to hold role = admin. Enforced by the '
  'users_guard_admin_allowlist trigger. Deliberately has no INSERT/UPDATE RLS '
  'policy: it is changed with the service role only, so no signed-in session — '
  'administrator or otherwise — can widen it from inside the application.';

insert into public.admin_allowlist (email, note) values
  ('hod.aiml@hkbk.edu.in',     'Head of Department, AI & ML'),
  ('afreenk.aiml@hkbk.edu.in', 'Portal administrator')
on conflict (email) do nothing;

alter table public.admin_allowlist enable row level security;

-- Read-only, and only for administrators. No write policy anywhere, on
-- purpose (see the comment above).
create policy "admin reads allowlist" on public.admin_allowlist
  for select to authenticated using (public.is_admin());

-- --- 2. Reconcile existing accounts -----------------------------------------
--
-- Runs before the trigger is installed so that the statements below are
-- describing the intended end state rather than fighting the guard.

-- Every allow-listed address that already has an account becomes an active
-- administrator, and gains the `admins` profile row the admin shell requires.
do $$
declare
  target record;
  code   text;
begin
  for target in
    select u.id, u.email
    from public.users u
    join public.admin_allowlist a on lower(a.email) = lower(u.email)
  loop
    update public.users
       set role = 'admin', status = 'active'
     where id = target.id;

    -- Reuse the employee code from an existing faculty record where there is
    -- one, so the same person is not recorded under two different codes.
    select f.employee_code into code
      from public.faculty f
     where f.user_id = target.id;

    insert into public.admins (user_id, full_name, employee_code, email, designation)
    values (
      target.id,
      coalesce(
        (select full_name from public.faculty  where user_id = target.id),
        (select full_name from public.students where user_id = target.id),
        target.email
      ),
      coalesce(code, 'ADM-' || substr(target.id::text, 1, 8)),
      target.email,
      'Portal Administrator'
    )
    on conflict (user_id) do nothing;
  end loop;
end $$;

-- Anyone holding `admin` who is not on the list loses it. Suspended rather
-- than quietly downgraded: an account that was administering the portal
-- without being entitled to is not a routine state, and it should require a
-- deliberate decision to bring back rather than silently becoming a faculty
-- login. This affects no existing account today; it is here so the guarantee
-- holds for accounts created later.
update public.users
   set role = 'faculty', status = 'suspended'
 where role = 'admin'
   and lower(email) not in (select lower(email) from public.admin_allowlist);

-- --- 3. The guard -----------------------------------------------------------

create or replace function public.guard_admin_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'admin'
     and not exists (
       select 1 from public.admin_allowlist a
        where lower(a.email) = lower(new.email)
     )
  then
    raise exception
      'Administrator access is limited to the approved allow-list; % is not on it.',
      new.email
      using hint = 'Add the address to public.admin_allowlist first (service role only).';
  end if;

  return new;
end;
$$;

-- Covers both routes to the role: the signup trigger's INSERT, and an
-- administrator's UPDATE in the approvals screen.
drop trigger if exists users_guard_admin_allowlist on public.users;
create trigger users_guard_admin_allowlist
  before insert or update on public.users
  for each row execute function public.guard_admin_allowlist();

-- --- 4. Head of Department scope --------------------------------------------
--
-- A HOD's profile lives in `public.faculty`, the same table as a mentor's —
-- they are a member of teaching staff with a department. What separates them
-- is `users.role = 'hod'`, which is what the function below keys off. That
-- keeps one staff table rather than a near-duplicate `hods`, and means every
-- existing faculty-scoped policy picks HODs up for free.

create or replace function public.is_hod()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'hod' and status = 'active'
       from public.users where id = auth.uid()),
    false
  );
$$;

/**
 * The department this caller heads, or NULL if they are not an active HOD.
 *
 * SECURITY DEFINER for the same reason as `current_faculty_id()`: it reads
 * `public.faculty` and `public.users`, both of which have policies that call
 * back into functions like this one.
 */
create or replace function public.current_hod_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select f.department_code
  from public.faculty f
  join public.users u on u.id = f.user_id
  where f.user_id = auth.uid()
    and u.role = 'hod'
    and u.status = 'active'
  limit 1;
$$;

/**
 * Extends the single visibility predicate (0003) with the HOD branch.
 *
 * Every faculty-scoped policy already added — students, academic profiles,
 * interests, goals, domains, languages (0003) and achievements plus their
 * evidence (0009) — routes through this function, so widening it here is what
 * gives a HOD their department without touching a single policy. That was the
 * point of centralising it in the first place (ARCHITECTURE section 11).
 *
 * The HOD branch deliberately ignores `p_mentor_only`, which is what drives
 * guardian-contact masking. A head of department is the person who actually
 * has to ring a guardian when a student in their department stops attending,
 * so withholding the number from them would break the process the masking
 * exists to protect. It stays scoped to their own department.
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
    );
$$;

-- A head of department can see the staff in their own department. Without
-- this they could see every student they are responsible for but not the
-- mentors those students are assigned to, which makes the assignment view
-- on their dashboard useless.
drop policy if exists "hod reads department faculty" on public.faculty;
create policy "hod reads department faculty" on public.faculty
  for select to authenticated
  using (department_code = public.current_hod_department());

drop policy if exists "hod reads department assignments"
  on public.faculty_student_assignments;
create policy "hod reads department assignments" on public.faculty_student_assignments
  for select to authenticated
  using (
    department_code = public.current_hod_department()
    or exists (
      select 1 from public.students s
      where s.id = faculty_student_assignments.student_id
        and s.department_code = public.current_hod_department()
    )
  );
