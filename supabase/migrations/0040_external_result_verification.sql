-- ===========================================================================
-- 0040_external_result_verification.sql — numeric external results, and a
-- faculty verify/reject decision on them.
--
-- 0032 stored a free-text `score_label` ("82%", "Elite", "Pass"). That was
-- right for what it was for — a list of things a student had done — but it
-- cannot be shown against a skill area, because "Elite" is not a position on
-- a scale. To reflect an outside result next to a portal-marked one, the
-- number has to be a number.
--
-- `score_label` stays. A result with no meaningful percentage — a band, a
-- grade, a pass — is still a real thing a student did, and forcing it into a
-- percentage would invent precision that was never there. So both live side
-- by side: the label is what they typed, the pair (score_value, max_score) is
-- filled in only when the result genuinely is a score out of something.
--
-- The verification decision is the other half. A self-reported number and a
-- number a member of staff has checked against a certificate are different
-- claims, and the schema keeps them apart rather than leaving it to the UI to
-- remember which is which. A student may write their own result; they may not
-- write the verdict on it. That is a trigger, not a convention.
-- ===========================================================================

create type public.external_verification as enum (
  'self_reported', 'verified', 'rejected'
);

alter table public.external_test_scores
  add column score_value numeric(7,2) check (score_value >= 0),
  add column max_score   numeric(7,2) check (max_score > 0),
  add column taken_on    date,
  add column verification_status public.external_verification
    not null default 'self_reported',
  add column verified_by uuid references public.faculty(id) on delete set null,
  add column verified_at timestamptz,
  add column reviewer_note text check (length(reviewer_note) <= 500);

-- A score out of nothing, or a score above its own maximum, is not a result
-- anyone can read. Both parts are required together or neither is given.
alter table public.external_test_scores
  add constraint external_score_pair check (
    (score_value is null and max_score is null)
    or (score_value is not null and max_score is not null and score_value <= max_score)
  );

-- A result cannot have been taken in the future.
create or replace function public.guard_external_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_reviewer boolean;
begin
  if new.taken_on is not null and new.taken_on > current_date then
    raise exception 'A result cannot be dated in the future.';
  end if;

  is_reviewer := public.is_admin()
                 or public.can_faculty_view_student(new.student_id);

  -- The student owns the claim; a reviewer owns the verdict on it. Without
  -- this a student could mark their own result 'verified' on the way past,
  -- and the badge a mentor relies on would mean nothing.
  if not is_reviewer then
    if tg_op = 'INSERT' then
      new.verification_status := 'self_reported';
      new.verified_by := null;
      new.verified_at := null;
      new.reviewer_note := null;
    else
      if new.verification_status is distinct from old.verification_status
         or new.verified_by is distinct from old.verified_by
         or new.verified_at is distinct from old.verified_at
         or new.reviewer_note is distinct from old.reviewer_note then
        raise exception 'Only a mentor or an administrator can verify a result.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger external_test_scores_guard
  before insert or update on public.external_test_scores
  for each row execute function public.guard_external_result();

-- Staff could already read these rows (0032). They now need to write the
-- verdict on one, and nothing else about it — the trigger above is what
-- stops this policy becoming a licence to edit a student's claim.
create policy "staff verifies external scores of visible students"
  on public.external_test_scores
  for update to authenticated
  using (public.is_admin() or public.can_faculty_view_student(student_id))
  with check (public.is_admin() or public.can_faculty_view_student(student_id));

create index external_test_scores_pending_idx
  on public.external_test_scores (verification_status)
  where verification_status = 'self_reported';
