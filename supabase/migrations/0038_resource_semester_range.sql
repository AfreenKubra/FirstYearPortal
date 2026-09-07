/**
 * Widens `resources.semester` from 1-2 to the full 1-8.
 *
 * The column was capped at two because the portal only ever held first-year
 * students, and a resource could not sensibly be aimed anywhere else. The
 * roadmap's career pathway changed that: it lays out all four stages —
 * Sem 1-2, 3-4, 5-6, 7-8 — and places curated study material at the stage
 * covering its semester. Material for the later stages is forward-looking
 * guidance a first-year can read now, so it needs a semester the check
 * constraint currently refuses.
 *
 * `vtu_subjects.semester` already allows 1-8, so this brings `resources` in
 * line with the table it sits beside rather than introducing a new range.
 *
 * Widening a CHECK cannot invalidate an existing row: everything that passed
 * 1-2 still passes 1-8.
 */

alter table public.resources
  drop constraint if exists resources_semester_check;

alter table public.resources
  add constraint resources_semester_check
  check (semester is null or (semester >= 1 and semester <= 8));
