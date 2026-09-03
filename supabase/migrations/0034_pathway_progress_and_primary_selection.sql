/**
 * Support for the career pathway timeline: which goal/domain is a student's
 * primary one (when they've picked more than one), and which pathway items
 * they've checked off.
 *
 * Deliberately separate from `roadmap_milestones` (0016) and its
 * immutable-text guard — that table belongs to the AI/rule-based roadmap and
 * its mentor-review workflow, which this feature does not touch. A pathway
 * item's completion is the student's own record-keeping, the same trust
 * level as `student_resources` (saved resources) rather than something a
 * mentor reviews.
 */

alter table public.student_goals   add column is_primary boolean not null default false;
alter table public.student_domains add column is_primary boolean not null default false;

-- At most one primary per student per table, enforced by the database rather
-- than trusted to application code — the same reasoning as every other
-- invariant in this schema that could otherwise be gotten wrong by a bug in
-- one code path while every other path stays correct.
create unique index student_goals_one_primary
  on public.student_goals (student_id) where is_primary;
create unique index student_domains_one_primary
  on public.student_domains (student_id) where is_primary;

create table public.pathway_item_progress (
  student_id   uuid not null references public.students(id) on delete cascade,
  -- Matches a `PathwayItemDef.id` from `src/config/pathways.ts` — static
  -- config, not a foreign key, since the pathway content lives in code and
  -- is reviewed the same way `link-providers.ts`'s whitelist is.
  item_id      text not null check (length(item_id) between 2 and 80),
  completed_at timestamptz not null default now(),
  primary key (student_id, item_id)
);

alter table public.pathway_item_progress enable row level security;

create policy "student manages own pathway progress" on public.pathway_item_progress
  for all
  using (student_id = public.current_student_id())
  with check (student_id = public.current_student_id());
