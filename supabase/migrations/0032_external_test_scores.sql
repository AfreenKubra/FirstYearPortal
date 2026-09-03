/**
 * Self-reported test scores from external platforms.
 *
 * These are a student's own claims about scores on NPTEL, Infosys
 * Springboard, or similar services. The portal cannot verify them, so every
 * UI surface labels them as self-reported and staff have no write path.
 */

create table public.external_test_scores (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  platform        text not null check (length(trim(platform)) between 2 and 80),
  test_name       text not null check (length(trim(test_name)) between 2 and 200),
  score_label     text not null check (length(trim(score_label)) between 1 and 60),
  certificate_url text check (certificate_url ~ '^https?://'),
  category        text check (
                     category in (
                       'aptitude', 'logical_reasoning', 'technical',
                       'communication', 'soft_skills', 'personality', 'other'
                     )
                   ),
  created_at      timestamptz not null default now()
);

create index external_test_scores_student_idx
  on public.external_test_scores (student_id);

alter table public.external_test_scores enable row level security;

create policy "student manages own external scores" on public.external_test_scores
  for all
  using (student_id = public.current_student_id())
  with check (student_id = public.current_student_id());

create policy "staff reads external scores of visible students"
  on public.external_test_scores
  for select
  using (public.is_admin() or public.can_faculty_view_student(student_id));
