-- ===========================================================================
-- 0012_multiple_roles.sql — one account, more than one role
--
-- Until now `users.role` was a single enum value, which made the real
-- structure of this institution unrepresentable: the head of AIML is also a
-- portal administrator, and the portal administrator is also a teaching
-- faculty member. Each of them could only reach one of their two portals.
--
-- The fix is a join table rather than a wider `users` row. Roles are a set,
-- and a set belongs in its own table — a `roles text[]` column would have to
-- be kept in step with `users.role` by hand, and every policy would need to
-- unnest it.
--
-- `users.role` survives as the PRIMARY role: it decides where an account
-- lands after sign-in and how it is labelled in the approvals queue. It stays
-- a member of `user_roles` too, so nothing has to consult two sources to
-- answer "may this account do X".
--
-- Requires 0010 (the 'hod' enum value) to have been applied.
-- ===========================================================================

create table if not exists public.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.user_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role);

comment on table public.user_roles is
  'Every role an account holds. users.role is the primary one — where they '
  'land at sign-in — and is always present here as well.';

-- --- Backfill ---------------------------------------------------------------
-- Runs before the helper functions are redefined below, so no caller ever
-- sees an empty set for an account that has a role.

insert into public.user_roles (user_id, role)
select id, role from public.users
on conflict (user_id, role) do nothing;

-- --- Keeping the primary role in the set ------------------------------------

create or replace function public.sync_primary_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, new.role)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

drop trigger if exists users_sync_primary_role on public.users;
create trigger users_sync_primary_role
  after insert or update of role on public.users
  for each row execute function public.sync_primary_role();

-- --- Membership test --------------------------------------------------------

/**
 * True when the caller holds `p_role` and their account is active.
 *
 * The status check lives here rather than at each call site because every
 * existing caller needed it and one of them would eventually forget: a
 * suspended administrator must stop being an administrator immediately, not
 * at their next token refresh.
 */
create or replace function public.has_role(p_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role = p_role
      and u.status = 'active'
  );
$$;

/** Every role the caller holds, for the application layer to route on. */
create or replace function public.current_roles()
returns public.user_role[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(ur.role order by ur.role), '{}')
  from public.user_roles ur
  join public.users u on u.id = ur.user_id
  where ur.user_id = auth.uid()
    and u.status = 'active';
$$;

-- --- Redefine the existing helpers in terms of the set ----------------------
-- Same names, same signatures, so every policy written against them keeps
-- working untouched. This is the second time centralising these has paid off.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin');
$$;

create or replace function public.current_hod_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select f.department_code
  from public.faculty f
  where f.user_id = auth.uid()
    and public.has_role('hod')
  limit 1;
$$;

-- A faculty member's id, now keyed off holding the faculty or hod role rather
-- than only off having a row in `faculty`. An administrator who happens to
-- have a staff record should not silently pick up mentor visibility they were
-- never granted.
create or replace function public.current_faculty_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id
  from public.faculty f
  where f.user_id = auth.uid()
    and (public.has_role('faculty') or public.has_role('hod'));
$$;

-- --- Administrator allow-list, extended to the new table --------------------
--
-- Without this the allow-list would have a hole the size of the feature:
-- `users.role` is guarded, but inserting ('someone', 'admin') straight into
-- `user_roles` would grant administrator just as effectively.

create or replace function public.guard_admin_allowlist_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if new.role <> 'admin' then
    return new;
  end if;

  select email into target_email from public.users where id = new.user_id;

  if target_email is null
     or not exists (
       select 1 from public.admin_allowlist a
        where lower(a.email) = lower(target_email)
     )
  then
    raise exception
      'Administrator access is limited to the approved allow-list; % is not on it.',
      coalesce(target_email, new.user_id::text)
      using hint = 'Add the address to public.admin_allowlist first (service role only).';
  end if;

  return new;
end;
$$;

drop trigger if exists user_roles_guard_admin_allowlist on public.user_roles;
create trigger user_roles_guard_admin_allowlist
  before insert or update on public.user_roles
  for each row execute function public.guard_admin_allowlist_roles();

-- --- RLS --------------------------------------------------------------------

alter table public.user_roles enable row level security;

create policy "read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create policy "admin reads all roles" on public.user_roles
  for select to authenticated using (public.is_admin());

create policy "admin grants roles" on public.user_roles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- Grant the roles this institution actually has ---------------------------
--
-- The head of AIML is also a portal administrator; the portal administrator
-- is also a teaching faculty member. Both were previously forced to choose.
-- Guarded by the faculty record existing, so this is a no-op on a database
-- where these accounts were never set up.

do $$
declare
  hod_id     uuid;
  faculty_id uuid;
  hod_name   text;
  hod_code   text;
begin
  select id into hod_id from public.users
   where lower(email) = 'hod.aiml@hkbk.edu.in';

  select id into faculty_id from public.users
   where lower(email) = 'afreenk.aiml@hkbk.edu.in';

  if hod_id is not null then
    -- A HOD's department comes from their `faculty` row, so an account with
    -- the role and no staff record would sign in to an empty portal. This
    -- account was only ever set up as an administrator, so the record has to
    -- be created from what the `admins` row already knows.
    if not exists (select 1 from public.faculty where user_id = hod_id) then
      select full_name, employee_code into hod_name, hod_code
        from public.admins where user_id = hod_id;

      insert into public.faculty
        (user_id, full_name, employee_code, email, phone, department_code, designation)
      values (
        hod_id,
        coalesce(hod_name, 'Head of Department, AIML'),
        coalesce(hod_code, 'HOD-AIML'),
        'hod.aiml@hkbk.edu.in',
        -- Placeholder: `faculty.phone` is NOT NULL and UNIQUE, and this
        -- account was created without one. Update it from the portal.
        '9999999999',
        'AIML',
        'Head of Department'
      )
      on conflict (user_id) do nothing;
    end if;

    insert into public.user_roles (user_id, role)
    values (hod_id, 'hod')
    on conflict do nothing;
  end if;

  if faculty_id is not null then
    insert into public.user_roles (user_id, role)
    values (faculty_id, 'faculty')
    on conflict do nothing;
  end if;
end $$;
