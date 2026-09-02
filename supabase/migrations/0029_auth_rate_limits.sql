-- ===========================================================================
-- 0029_auth_rate_limits.sql — rate limiting for the authentication endpoints.
--
-- Listed under "things worth doing before real students use this"
-- (MANUAL-STEPS section 7) and under README's known limitations. Without it,
-- /login is an unmetered password oracle: the seeded student passwords share
-- one suffix, so an attacker who learns the scheme can try thirty accounts as
-- fast as the network allows.
--
-- IT LIVES IN THE DATABASE, NOT IN MEMORY. The obvious implementation is a
-- Map in the Node process, and on Vercel that is security theatre — each
-- serverless invocation may be a fresh instance, so a counter held in one
-- never sees the attempt handled by another. A table is the only shared state
-- the deployment target actually has.
--
-- A fixed window rather than a sliding log: one row per bucket that resets
-- when the window expires, instead of one row per attempt. A sliding window
-- is more precise and would mean writing a row for every login attempt in the
-- institution, including the failed ones an attacker generates on purpose —
-- turning the defence into its own amplification.
-- ===========================================================================

create table if not exists public.auth_rate_limits (
  -- Opaque: '<action>:<sha256 of the subject>'. The subject is an email or an
  -- IP, and neither is stored in the clear. A table of addresses that failed
  -- to log in would be a list of people who typed a wrong password plus every
  -- address someone guessed at, which is not a record worth keeping.
  bucket       text primary key,

  window_start timestamptz not null default now(),
  attempts     integer not null default 0,
  updated_at   timestamptz not null default now()
);

create index if not exists auth_rate_limits_window_idx
  on public.auth_rate_limits (window_start);

/**
 * Records one attempt and reports whether it is still within the limit.
 *
 * Returns true when the caller may proceed. The insert and the check are one
 * statement so two simultaneous attempts cannot both read a stale count and
 * both be allowed — the row is locked by the upsert.
 */
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  insert into public.auth_rate_limits (bucket, window_start, attempts)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set
      -- An expired window restarts rather than accumulating, which is what
      -- makes this a window rather than a permanent ban.
      window_start = case
        when public.auth_rate_limits.window_start
             < now() - make_interval(secs => p_window_seconds)
        then now()
        else public.auth_rate_limits.window_start
      end,
      attempts = case
        when public.auth_rate_limits.window_start
             < now() - make_interval(secs => p_window_seconds)
        then 1
        else public.auth_rate_limits.attempts + 1
      end,
      updated_at = now()
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

/**
 * Forgets a bucket, called after a successful sign-in.
 *
 * Without this, someone who mistypes their password a few times and then gets
 * it right still spends the rest of the window one slip away from being
 * locked out of their own account. The limit exists to stop guessing, and a
 * correct password is proof this was not that.
 */
create or replace function public.clear_rate_limit(p_bucket text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_rate_limits where bucket = p_bucket;
$$;

/** Housekeeping: drops buckets nothing has touched for a day. */
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.auth_rate_limits
  where updated_at < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- --- RLS --------------------------------------------------------------------
--
-- Enabled with no policies at all, so no session reaches this table by any
-- route. The functions above are SECURITY DEFINER and the application calls
-- them with the service role, which is the only way in.
--
-- This matters more than it looks: were the table readable, the presence of a
-- bucket would confirm that somebody recently tried to sign in as a given
-- address — the account enumeration the login and reset flows are carefully
-- written to avoid, reintroduced through the back door.

alter table public.auth_rate_limits enable row level security;

revoke all on public.auth_rate_limits from anon, authenticated;

-- REVOKE FROM `public`, NOT JUST FROM anon AND authenticated.
--
-- Postgres grants EXECUTE on every new function to the PUBLIC pseudo-role by
-- default, and a grant to PUBLIC is not removed by revoking from the specific
-- roles that inherit it. Revoking only from anon and authenticated therefore
-- changes nothing at all, which was the first version of this file and was
-- caught by a test asserting the anon key could not call it.
--
-- It matters because these are SECURITY DEFINER: a caller who can reach
-- `consume_rate_limit` can burn a chosen bucket's allowance, and the buckets
-- are a hash of an email with a known scheme. That turns the defence into a
-- way to lock one student out of their own account on demand.
revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.clear_rate_limit(text)
  from public, anon, authenticated;
revoke all on function public.prune_rate_limits()
  from public, anon, authenticated;

-- The application reaches them with the service role and nothing else does.
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
grant execute on function public.clear_rate_limit(text) to service_role;
grant execute on function public.prune_rate_limits() to service_role;
