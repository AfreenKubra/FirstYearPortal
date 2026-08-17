-- ===========================================================================
-- 0010_hod_role_enum.sql — add the `hod` role to the user_role enum
--
-- This migration does one thing and nothing else, on purpose.
--
-- PostgreSQL will not let a transaction use an enum value that the same
-- transaction added. The migration runner (scripts/migrate.mjs) wraps each
-- file in its own transaction, and the Supabase SQL Editor does the same, so
-- adding 'hod' and then referencing it — in a policy, a function body, or an
-- UPDATE — would fail with "unsafe use of new value of enum type".
--
-- Splitting the ADD VALUE into its own file is what makes 0011 able to use it.
-- Run this one first, on its own, then 0011.
-- ===========================================================================

alter type public.user_role add value if not exists 'hod' after 'faculty';
