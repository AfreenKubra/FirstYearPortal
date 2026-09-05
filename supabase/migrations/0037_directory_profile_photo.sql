/**
 * Exposes the student's profile photo through `student_directory`.
 *
 * Staff screens read students exclusively through this view — that is what
 * applies the guardian-masking rules once, in the database, rather than
 * per screen. A column the view does not carry is a column those screens
 * cannot show, so surfacing the photo means adding it here.
 *
 * The column holds a *storage path*, not a URL. The bucket is private;
 * `getProfilePhotoUrl()` signs a short-lived URL per request, so nothing
 * readable leaks by virtue of appearing in this view.
 *
 * `create or replace` keeps the existing grants and the `security_invoker`
 * setting intact — every column below is reproduced exactly as it was, with
 * `profile_photo_url` added at the end so existing positional consumers are
 * undisturbed.
 */

create or replace view public.student_directory as
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
  case
    when is_admin() or is_assigned_mentor(s.id) then s.guardian_name
    else null::text
  end as guardian_name,
  case
    when is_admin() or is_assigned_mentor(s.id) then s.guardian_phone
    else null::text
  end as guardian_phone,
  is_admin() or is_assigned_mentor(s.id) as guardian_visible,
  s.profile_photo_url
from students s
  left join student_academic_profiles ap on ap.student_id = s.id;
