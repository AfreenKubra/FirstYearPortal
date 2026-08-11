-- ===========================================================================
-- 0006_email_sync.sql — keep users.email in step with auth.users.email
--
-- 0004 added a guard that raised on *any* change to `public.users.email`. The
-- intent was right — an admin must not be able to rewrite someone's address
-- and detach the shadow row from its auth identity — but the rule was too
-- broad: it also blocked the legitimate case, where the address changes in
-- Supabase Auth and the shadow row needs to follow.
--
-- The invariant that actually matters is narrower: `public.users.email` must
-- always mirror `auth.users.email`. So the guard now permits a change only
-- when the new value matches the auth identity, and a trigger on auth.users
-- performs that sync automatically.
-- ===========================================================================

create or replace function public.guard_users_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'users.id is immutable';
  end if;

  if new.email is distinct from old.email then
    -- Permitted only when it now agrees with Supabase Auth. An admin setting
    -- an arbitrary address still fails; the sync trigger below succeeds.
    if new.email is distinct from (
      select u.email from auth.users u where u.id = new.id
    ) then
      raise exception
        'users.email must match auth.users.email; change the address in Supabase Auth instead';
    end if;
  end if;

  return new;
end;
$$;

-- Mirrors an address change made in Supabase Auth down onto the shadow row.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();
