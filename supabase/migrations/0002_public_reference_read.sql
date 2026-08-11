-- ===========================================================================
-- 0002_public_reference_read.sql
--
-- Fixes a gate introduced in 0001: the reference-table read policies were
-- granted `to authenticated`, but `/register` is a public page. A prospective
-- student has no session yet, so they hit these tables as `anon` and got zero
-- rows — leaving the department and language pickers empty and registration
-- impossible to complete.
--
-- Only `departments` and `languages` are opened to `anon`, because only those
-- two are needed before an account exists. `interests`, `career_goals`, and
-- `technical_domains` are used solely on `/complete-profile`, which is behind
-- auth, so they stay `authenticated`-only rather than being widened out of
-- symmetry.
--
-- Both lists are non-sensitive public facts about the college (the department
-- names are on the prospectus), so exposing them pre-auth reveals nothing.
-- ===========================================================================

drop policy if exists "reference read" on public.departments;
create policy "reference read" on public.departments
  for select to anon, authenticated using (true);

drop policy if exists "reference read" on public.languages;
create policy "reference read" on public.languages
  for select to anon, authenticated using (true);
