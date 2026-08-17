-- ===========================================================================
-- 0009_achievements.sql — student achievements and faculty verification
--
-- Covers PRD 5.4. Students record achievements with optional evidence; the
-- assigned mentor or an administrator verifies or rejects them, and the
-- student sees that outcome with any remarks.
--
-- The security problem this migration has to solve: RLS grants access per
-- *row*, not per *column*. A student legitimately needs UPDATE on their own
-- achievement (to fix a typo), but must never be able to set
-- `verification_status = 'verified'` on it. Policies alone cannot express
-- that, so triggers pin the verification columns — the same approach used for
-- `users.email` in 0004.
-- ===========================================================================

create type public.achievement_category as enum (
  'academic', 'technical', 'sports', 'cultural',
  'certification', 'social_service', 'entrepreneurship', 'other'
);

create type public.achievement_level as enum (
  'college', 'district', 'state', 'national', 'international'
);

create type public.verification_status as enum ('pending', 'verified', 'rejected');

create table public.achievements (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students(id) on delete cascade,
  category            public.achievement_category not null,
  title               text not null check (length(trim(title)) between 3 and 160),
  description         text check (length(description) <= 1000),
  level               public.achievement_level not null,
  organisation        text check (length(organisation) <= 160),
  achieved_on         date not null,
  verification_status public.verification_status not null default 'pending',
  verified_by         uuid references public.faculty(id) on delete set null,
  verified_at         timestamptz,
  remarks             text check (length(remarks) <= 500),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- An achievement cannot be dated in the future.
  constraint achieved_on_not_future check (achieved_on <= current_date)
);

create index achievements_student_idx on public.achievements (student_id);
create index achievements_status_idx on public.achievements (verification_status);
create index achievements_category_idx on public.achievements (category);

create trigger achievements_touch_updated_at
  before update on public.achievements
  for each row execute function public.touch_updated_at();

-- Evidence files. The row records where the object lives; the bytes are in
-- Supabase Storage, governed by the storage policies at the end of this file.
create table public.achievement_documents (
  id             uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     integer not null check (size_bytes > 0),
  uploaded_at    timestamptz not null default now()
);

create index achievement_documents_achievement_idx
  on public.achievement_documents (achievement_id);

-- --- Verification guards ----------------------------------------------------

/**
 * A new achievement always starts unverified, whoever creates it. Without
 * this, a student could insert one already marked 'verified' — RLS would
 * happily allow the row, because it only checks *which* row, not what is in
 * it.
 */
create or replace function public.force_achievement_pending_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.can_faculty_view_student(new.student_id)) then
    new.verification_status := 'pending';
    new.verified_by := null;
    new.verified_at := null;
    new.remarks := null;
  end if;
  return new;
end;
$$;

create trigger achievements_force_pending
  before insert on public.achievements
  for each row execute function public.force_achievement_pending_on_insert();

/**
 * Verification columns are immutable to the student who owns the row. They
 * may edit the facts of their achievement freely; the verdict on it belongs
 * to their mentor.
 *
 * Editing a verified achievement resets it to pending — otherwise a student
 * could get a minor entry approved and then rewrite it into something else
 * while keeping the verified badge.
 */
create or replace function public.guard_achievement_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_reviewer boolean;
begin
  is_reviewer := public.is_admin() or public.can_faculty_view_student(new.student_id);

  if not is_reviewer then
    if new.verification_status is distinct from old.verification_status
       or new.verified_by is distinct from old.verified_by
       or new.verified_at is distinct from old.verified_at
       or new.remarks is distinct from old.remarks then
      raise exception
        'Only an assigned mentor or an administrator can change verification.';
    end if;

    -- Substantive edit to an already-reviewed achievement: send it back.
    if old.verification_status <> 'pending'
       and (new.title is distinct from old.title
            or new.category is distinct from old.category
            or new.level is distinct from old.level
            or new.achieved_on is distinct from old.achieved_on
            or new.organisation is distinct from old.organisation) then
      new.verification_status := 'pending';
      new.verified_by := null;
      new.verified_at := null;
      new.remarks := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger achievements_guard_verification
  before update on public.achievements
  for each row execute function public.guard_achievement_verification();

-- --- RLS --------------------------------------------------------------------

alter table public.achievements enable row level security;
alter table public.achievement_documents enable row level security;

-- Students: full control of their own records, subject to the triggers above.
create policy "student reads own achievements" on public.achievements
  for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = achievements.student_id and s.user_id = auth.uid()
  ));

create policy "student writes own achievements" on public.achievements
  for insert to authenticated
  with check (exists (
    select 1 from public.students s
    where s.id = achievements.student_id and s.user_id = auth.uid()
  ));

create policy "student edits own achievements" on public.achievements
  for update to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = achievements.student_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = achievements.student_id and s.user_id = auth.uid()
  ));

create policy "student deletes own achievements" on public.achievements
  for delete to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = achievements.student_id and s.user_id = auth.uid()
  ));

-- Faculty: read and verify achievements of students they are assigned.
create policy "faculty reads assigned achievements" on public.achievements
  for select to authenticated
  using (public.can_faculty_view_student(student_id));

create policy "faculty verifies assigned achievements" on public.achievements
  for update to authenticated
  using (public.can_faculty_view_student(student_id))
  with check (public.can_faculty_view_student(student_id));

create policy "admin reads all achievements" on public.achievements
  for select to authenticated using (public.is_admin());

create policy "admin verifies achievements" on public.achievements
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Documents inherit their parent achievement's access.
create policy "read documents of visible achievements" on public.achievement_documents
  for select to authenticated
  using (exists (
    select 1 from public.achievements a
    join public.students s on s.id = a.student_id
    where a.id = achievement_documents.achievement_id
      and (s.user_id = auth.uid()
           or public.can_faculty_view_student(a.student_id)
           or public.is_admin())
  ));

create policy "student attaches own documents" on public.achievement_documents
  for insert to authenticated
  with check (exists (
    select 1 from public.achievements a
    join public.students s on s.id = a.student_id
    where a.id = achievement_documents.achievement_id and s.user_id = auth.uid()
  ));

create policy "student removes own documents" on public.achievement_documents
  for delete to authenticated
  using (exists (
    select 1 from public.achievements a
    join public.students s on s.id = a.student_id
    where a.id = achievement_documents.achievement_id and s.user_id = auth.uid()
  ));

-- --- Storage ----------------------------------------------------------------
--
-- Private bucket: evidence can include certificates carrying a student's
-- name and identifiers, so nothing here is world-readable. Files are served
-- through short-lived signed URLs generated server-side.
--
-- Paths are `<student_id>/<achievement_id>/<filename>`, which is what lets
-- the policies below authorise by folder without a join back to the row.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'achievement-evidence',
  'achievement-evidence',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "student uploads own evidence" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'achievement-evidence'
    and exists (
      select 1 from public.students s
      where s.user_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
    )
  );

create policy "student reads own evidence" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'achievement-evidence'
    and exists (
      select 1 from public.students s
      where s.user_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
    )
  );

create policy "student deletes own evidence" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'achievement-evidence'
    and exists (
      select 1 from public.students s
      where s.user_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
    )
  );

create policy "reviewer reads assigned evidence" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'achievement-evidence'
    and (
      public.is_admin()
      or public.can_faculty_view_student(((storage.foldername(name))[1])::uuid)
    )
  );
