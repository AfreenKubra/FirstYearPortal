-- Private student profile photos. The students.profile_photo_url column stores
-- the object path; pages turn it into a short-lived signed URL when rendering.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "student uploads own profile photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from public.students s
      where s.user_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
    )
  );

create policy "student reads own profile photo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from public.students s
      where s.user_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
    )
  );

create policy "student deletes own profile photo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from public.students s
      where s.user_id = auth.uid()
        and s.id::text = (storage.foldername(name))[1]
    )
  );
