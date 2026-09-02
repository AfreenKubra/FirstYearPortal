-- ===========================================================================
-- 0022_roadmap_milestone_links.sql — concrete links attached to a milestone
--
-- PRD 5.10's roadmap now points at real, checkable resources — exams,
-- workshops, courses, certifications — instead of prose alone. Two
-- structural rules keep this from becoming exactly what 0016 and
-- MANUAL-STEPS.md 3.3 warn a roadmap generator against — inventing a course,
-- a certification, or a URL:
--
--   * A 'catalogue' link is only ever a real row from the admin-verified
--     `resources` table (PRD 5.9): `resource_id` is set and `url` is copied
--     from a link a person already vouched for (or deliberately left
--     unverified but visible, per 0015's own honesty rule).
--
--   * An 'ai_suggested' link's `url` is never a language model's raw text.
--     Application code (src/lib/roadmap/link-providers.ts) builds it
--     deterministically from a small, hardcoded whitelist of real provider
--     domains; the model only ever supplies a provider name and a search
--     keyword, and this table does not even have a column for either. See
--     MANUAL-STEPS.md 3.4 for the full reasoning.
--
-- Immutable once written, like `roadmap_milestones` itself (0016's
-- `guard_milestone_text`): a link a student has already seen must not
-- silently change underneath them. Regenerating the roadmap creates new
-- milestones — and so new links — rather than editing these rows.
-- ===========================================================================

create type public.milestone_link_source as enum ('catalogue', 'ai_suggested');

create table public.roadmap_milestone_links (
  id           uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.roadmap_milestones(id) on delete cascade,

  link_source  public.milestone_link_source not null,

  -- Only for a 'catalogue' link — the resource a person already reviewed.
  -- `on delete set null` rather than cascade: if the catalogue entry is later
  -- removed, the fact a milestone once pointed somewhere stays on record even
  -- though the row it pointed to is gone.
  resource_id  uuid references public.resources(id) on delete set null,

  title        text not null check (length(trim(title)) between 3 and 200),

  -- For a catalogue link this is copied from `resources.url` at attach time.
  -- For an ai_suggested link this is built deterministically by application
  -- code from a fixed provider whitelist — never the model's own text — which
  -- is what makes this column safe to trust regardless of `link_source`.
  url          text not null check (url ~* '^https?://'),

  provider     text check (length(provider) <= 120),
  kind         public.resource_kind not null default 'other',

  position     integer not null default 0,
  created_at   timestamptz not null default now(),

  -- A catalogue link must actually point at a resource; an ai_suggested link
  -- must not. This is what stops the model ever being attributed a link it
  -- cannot back with a real catalogue row, and stops a catalogue link from
  -- silently losing its provenance.
  constraint roadmap_milestone_links_source_shape check (
    (link_source = 'catalogue' and resource_id is not null)
    or (link_source = 'ai_suggested' and resource_id is null)
  )
);

create index roadmap_milestone_links_milestone_idx
  on public.roadmap_milestone_links (milestone_id, position);
create index roadmap_milestone_links_resource_idx
  on public.roadmap_milestone_links (resource_id);

-- --- Guard -------------------------------------------------------------

/**
 * A link is fixed once written, exactly like a milestone's own wording
 * (`guard_milestone_text` in 0016). Regenerate the roadmap for different
 * links rather than editing one in place.
 */
create or replace function public.guard_milestone_link_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'A roadmap milestone link cannot be changed. Regenerate the roadmap instead.';
end;
$$;

create trigger roadmap_milestone_links_guard_immutable
  before update on public.roadmap_milestone_links
  for each row execute function public.guard_milestone_link_immutable();

-- --- RLS -----------------------------------------------------------------

alter table public.roadmap_milestone_links enable row level security;

-- The bare EXISTS is doing the work, exactly as in 0016's "read milestones of
-- visible roadmaps": `roadmap_milestones` is itself RLS-protected, so a row
-- only "exists" here if one of *its* policies already let the caller see it.
-- Whatever roadmap visibility currently is — a student's own non-superseded
-- roadmap (0019), or a staff/admin view — a link inherits it automatically,
-- with nothing to keep in sync here if that rule changes again.
create policy "read links of visible milestones" on public.roadmap_milestone_links
  for select to authenticated
  using (exists (
    select 1 from public.roadmap_milestones m
    where m.id = roadmap_milestone_links.milestone_id
  ));

-- Only trusted server code, an administrator, or a staff member who may
-- already see the student can attach a link — a student cannot invent their
-- own link on their own plan.
create policy "server and staff create milestone links" on public.roadmap_milestone_links
  for insert to authenticated
  with check (
    public.is_trusted_server()
    or public.is_admin()
    or exists (
      select 1 from public.roadmap_milestones m
      join public.student_roadmaps r on r.id = m.roadmap_id
      where m.id = roadmap_milestone_links.milestone_id
        and public.can_faculty_view_student(r.student_id)
    )
  );

-- No UPDATE policy: RLS default-denies before `guard_milestone_link_immutable`
-- even runs, the same belt-and-suspenders arrangement 0016 uses for milestone
-- text.

create policy "admin and server delete milestone links" on public.roadmap_milestone_links
  for delete to authenticated
  using (public.is_admin() or public.is_trusted_server());
