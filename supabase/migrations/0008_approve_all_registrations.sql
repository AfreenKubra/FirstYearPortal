-- ===========================================================================
-- 0008_approve_all_registrations.sql — every new account needs approval
--
-- Until now `handle_new_auth_user` activated students immediately and held
-- only faculty and administrators as 'pending'. That reflected PRD section
-- 5.1 ("student self-registration is open"). The institution has since
-- decided that every account, students included, must be approved by an
-- administrator before it can be used.
--
-- Two consequences worth being deliberate about:
--
--   * Every first-year student now needs a manual decision. For a full
--     intake that is a real workload, concentrated in the first days of
--     term. The approvals queue sorts oldest-first so the backlog is worked
--     in the order students joined.
--
--   * A student can still *create* their profile while pending — the RLS
--     insert policy keys off `user_id = auth.uid()`, not status — so the
--     registration form completes and their record is intact. Middleware
--     then holds them at /pending-approval until approved. Nothing they
--     entered is lost while they wait.
--
-- Accounts that already exist are left alone. This changes what happens to
-- new registrations, and does not retroactively suspend anyone.
-- ===========================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'student'
  );

  -- Every role starts pending. The role itself is still taken from metadata,
  -- but it grants nothing on its own: authority requires status = 'active',
  -- which only an existing active administrator can set.
  insert into public.users (id, email, role, status)
  values (new.id, new.email, requested_role, 'pending');

  return new;
end;
$$;
