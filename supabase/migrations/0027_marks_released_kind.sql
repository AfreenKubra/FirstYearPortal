-- ===========================================================================
-- 0027_marks_released_kind.sql — adds 'marks_released' to notification_kind,
-- ON ITS OWN, and nothing else.
--
-- Postgres will not let a transaction use an enum value it added, and both
-- the SQL Editor and `scripts/migrate.mjs` wrap each file in one. 0028 is
-- what uses this. Splitting them is the same reason 0010 and 0018 exist as
-- single-statement files — see README's migrations table, which records that
-- running them together fails with "unsafe use of new value of enum type".
-- ===========================================================================

alter type public.notification_kind add value if not exists 'marks_released';
