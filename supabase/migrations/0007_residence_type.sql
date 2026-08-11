-- ===========================================================================
-- 0007_residence_type.sql — replace `accommodation` with `residence_type`
--
-- The original two-value enum (day_scholar / hosteller) forced every student
-- into a binary that does not describe how first-year students actually live:
-- a student in a PG or a rented flat is neither a hosteller nor living at
-- home, and had to pick a wrong answer. That inaccuracy then propagated into
-- the faculty filters and the institution analytics.
--
-- Replaced with four real options, and the field renamed to `residence_type`
-- so the column says what it holds.
--
-- Existing data is mapped, not discarded:
--     hosteller   -> hostel
--     day_scholar -> home
--
-- 'home' is the honest mapping for a day scholar: it is what the old label
-- meant in practice. Students who are actually in a PG or flat can correct it
-- themselves — the value stays editable in the profile.
-- ===========================================================================

-- The view reads students.accommodation, so it has to go before the column
-- can be dropped, and is rebuilt at the end of this migration.
drop view if exists public.student_directory;

create type public.residence_type as enum ('hostel', 'pg', 'flat', 'home');

alter table public.students
  add column residence_type public.residence_type;

update public.students
   set residence_type = case accommodation
                          when 'hosteller'   then 'hostel'::public.residence_type
                          when 'day_scholar' then 'home'::public.residence_type
                        end
 where accommodation is not null;

alter table public.students drop column accommodation;
drop type if exists public.accommodation_type;

-- --- Rebuild the guardian-masking view --------------------------------------
-- Identical to 0003 apart from the renamed column. `security_invoker` remains
-- load-bearing: without it the view runs as its owner and bypasses the row
-- policies on `students`.

create view public.student_directory
with (security_invoker = true)
as
select
  s.id,
  s.user_id,
  s.full_name,
  s.usn,
  s.email,
  s.phone,
  s.dob,
  s.state,
  s.city,
  s.department_code,
  s.residence_type,
  s.profile_completion_percent,
  s.created_at,
  ap.tenth_percentage,
  ap.twelfth_percentage,
  ap.quota,
  ap.entrance_rank,
  ap.semester,
  ap.section,
  ap.admission_year,
  case when public.is_admin() or public.is_assigned_mentor(s.id)
       then s.guardian_name end as guardian_name,
  case when public.is_admin() or public.is_assigned_mentor(s.id)
       then s.guardian_phone end as guardian_phone,
  (public.is_admin() or public.is_assigned_mentor(s.id)) as guardian_visible
from public.students s
left join public.student_academic_profiles ap on ap.student_id = s.id;

grant select on public.student_directory to authenticated;
