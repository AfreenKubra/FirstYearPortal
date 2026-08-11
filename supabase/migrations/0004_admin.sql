-- ===========================================================================
-- 0004_admin.sql — Admin records, write policies, and account lifecycle
--
-- Covers PRD 5.6 (admin dashboard, department management, faculty assignment
-- management, account approval) and the audit-log read path from 5.1.
--
-- Everything an admin *writes* is gated on `is_admin()`, which reads
-- `users.role`/`status` live rather than trusting a JWT claim — so revoking
-- an admin takes effect on their very next statement.
-- ===========================================================================

-- --- Admin records ----------------------------------------------------------

create table public.admins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  full_name     text not null,
  employee_code text not null unique,
  email         text not null unique,
  designation   text not null default 'Portal Administrator',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger admins_touch_updated_at
  before update on public.admins
  for each row execute function public.touch_updated_at();

alter table public.admins enable row level security;

create policy "own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());
create policy "admin reads all admins" on public.admins
  for select to authenticated using (public.is_admin());
create policy "admin writes admins" on public.admins
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- Account lifecycle ------------------------------------------------------
--
-- Admins may change another account's role and status (approve, reject,
-- suspend). RLS cannot restrict *which columns* an update touches, so a
-- trigger pins the immutable ones — otherwise this policy would also permit
-- rewriting a user's id or email, which would silently detach the shadow row
-- from its auth identity.

create or replace function public.guard_users_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'users.id is immutable';
  end if;
  if new.email is distinct from old.email then
    raise exception 'users.email is managed by Supabase Auth, not directly';
  end if;
  return new;
end;
$$;

create trigger users_guard_immutable
  before update on public.users
  for each row execute function public.guard_users_immutable_columns();

create policy "admin updates accounts" on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- Reference-data management (PRD 5.6) ------------------------------------
-- Departments and the lookup tables become admin-writable. 0001 deliberately
-- left these with no write policy at all; this is the migration that turns
-- "configurable without a deploy" from a design claim into a real capability.

create policy "admin writes departments" on public.departments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin writes languages" on public.languages
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin writes interests" on public.interests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin writes career goals" on public.career_goals
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin writes technical domains" on public.technical_domains
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- Faculty assignment management ------------------------------------------
-- 0003 gave faculty read-only sight of their own assignments. This is what
-- lets an admin actually create them through the UI instead of by hand.

create policy "admin writes assignments" on public.faculty_student_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin writes faculty" on public.faculty
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- Audit log --------------------------------------------------------------
--
-- Still no INSERT policy, deliberately. Audit rows are written server-side
-- with the service role, so a compromised session cannot forge or suppress an
-- entry about itself. Admins keep read-only access (granted in 0001).

-- ===========================================================================
-- BOOTSTRAP — creating the first administrator
--
-- There is no self-service path to an admin account, by design (PRD section
-- 3): admin accounts are only ever created by another admin. That leaves the
-- first one, which has to be made by hand, once.
--
-- 1. Register an account through /register with the email you want to use for
--    the administrator.
-- 2. Run the block below, changing only the three values at the top.
--
-- Matching on email rather than uuid on purpose — no copying ids out of the
-- dashboard, and it fails loudly if the address is wrong instead of silently
-- updating nothing.
--
-- Uncomment and edit before running:
--
-- do $$
-- declare
--   admin_email text := 'you@hkbk.edu.in';        -- <- the account you registered
--   admin_name  text := 'Portal Administrator';
--   admin_code  text := 'ADM001';
--   target_id   uuid;
-- begin
--   select id into target_id from public.users where email = admin_email;
--
--   if target_id is null then
--     raise exception 'No account found with email %. Register it first.', admin_email;
--   end if;
--
--   update public.users
--      set role = 'admin', status = 'active'
--    where id = target_id;
--
--   insert into public.admins (user_id, full_name, employee_code, email)
--   values (target_id, admin_name, admin_code, admin_email)
--   on conflict (user_id) do nothing;
--
--   -- A student row left over from step 1 would make the administrator show
--   -- up in faculty directories as a student. Remove it.
--   delete from public.students where user_id = target_id;
--
--   raise notice 'Administrator ready: %', admin_email;
-- end $$;
-- ===========================================================================
