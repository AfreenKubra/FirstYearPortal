-- ===========================================================================
-- 0005_staff_registration.sql — let an administrator *request* an account
--
-- 0004 gave `admins` only an admin-gated write policy, which made the table
-- unreachable for the person who needs it most: someone registering as an
-- administrator has `status = 'pending'`, so `is_admin()` is false for them
-- and the insert of their own profile row failed.
--
-- Granting insert-own here is safe because a row in `admins` carries no
-- privilege by itself. Authority comes from `users.role = 'admin'` AND
-- `users.status = 'active'` — both of which only an existing active admin can
-- set. Until that happens the profile row is inert, and middleware keeps the
-- account on /pending-approval regardless.
-- ===========================================================================

create policy "insert own admin row" on public.admins
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "update own admin row" on public.admins
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- BOOTSTRAP — the first administrator (revised)
--
-- With staff registration in place this no longer involves creating and then
-- deleting a student record. The flow is now:
--
--   1. Go to /register/staff and register as **Administrator**. This creates
--      the auth user, the `users` shadow row (role 'admin', status 'pending'),
--      and the `admins` profile row.
--   2. Nobody can approve you yet — you would be approving yourself — so run
--      the one statement below to activate that first account.
--   3. Every administrator after this one is approved in the portal, under
--      Account approvals.
--
-- Uncomment, set the email, and run:
--
-- update public.users
--    set status = 'active'
--  where email = 'admin@hkbk.edu.in'
--    and role = 'admin';
-- ===========================================================================
