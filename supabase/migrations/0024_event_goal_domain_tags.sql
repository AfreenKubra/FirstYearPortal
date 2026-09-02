-- ===========================================================================
-- 0024_event_goal_domain_tags.sql — what an event is *about* (PRD 5.8/5.10)
--
-- `events` has always known who an event is *for* — department, semester,
-- section, resolved by `event_targets_student` — but never what it is *about*.
-- That gap is why the roadmap cannot currently answer "how many workshops are
-- there for the goal I picked?": audience and subject are different questions,
-- and only the first one had an answer.
--
-- These tables mirror `resource_interests`/`resource_goals`/`resource_domains`
-- from `0015_resources.sql` exactly, and for the same reason: reusing the
-- vocabulary students already used to describe themselves at registration is
-- what makes "3 workshops matching your goal" a fact the database can support
-- rather than a sentence the UI makes up.
--
-- There is deliberately no `event_interests`. Interests are not how a workshop
-- is pitched — a session is about Cybersecurity or aimed at GATE candidates,
-- not about "Programming" in the abstract — and a third multiselect would
-- triple the burden on the faculty publishing form while answering no question
-- the first two do not already answer. It can be added later if that turns out
-- to be wrong; removing an unused tag table is harder than adding one.
--
-- Tagging is optional. An untagged event is not broken, it is simply an event
-- that appears on the calendar without claiming a subject — which is what most
-- events published before this migration are, and they must stay valid.
-- ===========================================================================

create table if not exists public.event_goals (
  event_id uuid    not null references public.events(id)        on delete cascade,
  goal_id  integer not null references public.career_goals(id)  on delete cascade,
  primary key (event_id, goal_id)
);

create table if not exists public.event_domains (
  event_id  uuid    not null references public.events(id)              on delete cascade,
  domain_id integer not null references public.technical_domains(id)   on delete cascade,
  primary key (event_id, domain_id)
);

-- The primary key already covers (event_id, …); these cover the other
-- direction, which is the one the roadmap queries by ("events for goal N").
create index if not exists event_goals_goal_idx    on public.event_goals (goal_id);
create index if not exists event_domains_domain_idx on public.event_domains (domain_id);

-- --- RLS --------------------------------------------------------------------
--
-- Readable by any signed-in user, exactly as `read resource goals` is. A tag
-- row is meaningless on its own — it is two foreign keys — and the event it
-- points at is already gated by `events`' own policies. Gating the tag as well
-- would mean writing the audience-resolution logic twice and keeping the two
-- copies in step, with nothing gained: a student who cannot see the event
-- learns nothing from knowing an id they cannot resolve.

alter table public.event_goals   enable row level security;
alter table public.event_domains enable row level security;

drop policy if exists "read event goals" on public.event_goals;
create policy "read event goals" on public.event_goals
  for select to authenticated using (true);

drop policy if exists "read event domains" on public.event_domains;
create policy "read event domains" on public.event_domains
  for select to authenticated using (true);

-- Writes follow the parent event: whoever may edit the event may tag it. This
-- mirrors `write resource goals`, and matches `staff writes own events` in
-- 0014 so a faculty member cannot tag an event they could not otherwise touch.
drop policy if exists "write event goals" on public.event_goals;
create policy "write event goals" on public.event_goals
  for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_goals.event_id
      and (e.created_by = public.current_faculty_id() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_goals.event_id
      and (e.created_by = public.current_faculty_id() or public.is_admin())
  ));

drop policy if exists "write event domains" on public.event_domains;
create policy "write event domains" on public.event_domains
  for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_domains.event_id
      and (e.created_by = public.current_faculty_id() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_domains.event_id
      and (e.created_by = public.current_faculty_id() or public.is_admin())
  ));
