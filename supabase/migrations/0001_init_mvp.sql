-- ===========================================================================
-- 0001_init_mvp.sql — Foundation schema for the First-Year Portal
--
-- Covers PRD 5.1 (auth/account lifecycle) and 5.2 (registration + mandatory
-- profile). Corresponds to ARCHITECTURE.md section 5.1.
--
-- Security posture: RLS is enabled on EVERY table that holds student data,
-- and the policies here are the third and last line of defence (after
-- middleware and server actions). Faculty read policies are deliberately
-- absent — they depend on `faculty_student_assignments`, which does not
-- exist yet, and a blanket "faculty can read all students" policy would be
-- a security regression rather than a head start.
-- ===========================================================================

-- --- Enums ------------------------------------------------------------------

create type public.user_role as enum ('student', 'faculty', 'admin');
create type public.account_status as enum ('pending', 'active', 'rejected', 'suspended');
create type public.accommodation_type as enum ('day_scholar', 'hosteller');
create type public.admission_quota as enum ('cet', 'comedk', 'management', 'jee', 'diploma_lateral', 'other');

-- --- Reference / lookup tables ----------------------------------------------
-- Lookup tables rather than enums so admins can extend the options with a
-- data change instead of a deploy (PRD 5.6 / ARCHITECTURE 5.1).

create table public.departments (
  code        text primary key,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.languages (
  id          serial primary key,
  name        text not null unique,
  is_active   boolean not null default true
);

create table public.interests (
  id          serial primary key,
  name        text not null unique,
  category    text,
  is_active   boolean not null default true
);

create table public.career_goals (
  id          serial primary key,
  name        text not null unique,
  is_active   boolean not null default true
);

create table public.technical_domains (
  id          serial primary key,
  name        text not null unique,
  is_active   boolean not null default true
);

-- --- Identity ---------------------------------------------------------------
-- Shadow table, 1:1 with auth.users. `role` and `status` live here rather
-- than only in the JWT so that a role change or suspension takes effect on
-- the very next request, without waiting for a token refresh.

create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  role          public.user_role not null default 'student',
  status        public.account_status not null default 'pending',
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index users_role_status_idx on public.users (role, status);

-- --- Student academic record ------------------------------------------------
-- `students.id` is a surrogate key, separate from `user_id`, so later tables
-- (achievements, assessments, roadmaps) reference the academic record rather
-- than the auth identity — keeping auth concerns and academic-record
-- concerns decoupled (ARCHITECTURE 5.1).

create table public.students (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null unique references auth.users(id) on delete cascade,
  full_name                  text not null,
  dob                        date not null,
  usn                        text not null unique,
  phone                      text not null unique,
  email                      text not null unique,
  username                   text not null unique,
  state                      text not null,
  city                       text not null,
  department_code            text not null references public.departments(code),
  guardian_name              text not null,
  guardian_phone             text not null,
  profile_photo_url          text,
  accommodation              public.accommodation_type,
  profile_completion_percent smallint not null default 0
                               check (profile_completion_percent between 0 and 100),
  consent_given_at           timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index students_user_id_idx on public.students (user_id);
create index students_department_idx on public.students (department_code);
create index students_completion_idx on public.students (profile_completion_percent);

create table public.student_academic_profiles (
  student_id        uuid primary key references public.students(id) on delete cascade,
  tenth_percentage  numeric(5,2) check (tenth_percentage between 0 and 100),
  twelfth_percentage numeric(5,2) check (twelfth_percentage between 0 and 100),
  quota             public.admission_quota,
  entrance_rank     integer check (entrance_rank >= 0),
  semester          smallint check (semester between 1 and 2),
  section           text,
  admission_year    smallint check (admission_year between 2000 and 2100),
  updated_at        timestamptz not null default now()
);

create table public.student_languages (
  student_id  uuid not null references public.students(id) on delete cascade,
  language_id integer not null references public.languages(id),
  primary key (student_id, language_id)
);

create table public.student_interests (
  student_id  uuid not null references public.students(id) on delete cascade,
  interest_id integer not null references public.interests(id),
  primary key (student_id, interest_id)
);

create table public.student_goals (
  student_id uuid not null references public.students(id) on delete cascade,
  goal_id    integer not null references public.career_goals(id),
  primary key (student_id, goal_id)
);

create table public.student_domains (
  student_id uuid not null references public.students(id) on delete cascade,
  domain_id  integer not null references public.technical_domains(id),
  primary key (student_id, domain_id)
);

-- Append-only consent log (PRD section 6, privacy).
create table public.consent_records (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  consent_type  text not null,
  consent_text  text not null,
  granted       boolean not null,
  granted_at    timestamptz not null default now()
);

create index consent_records_student_idx on public.consent_records (student_id);

-- Append-only audit log, admin-read-only (PRD 5.1).
create table public.audit_logs (
  id            bigserial primary key,
  actor_user_id uuid references public.users(id) on delete set null,
  action        text not null,
  entity_type   text,
  entity_id     text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- --- Helper functions -------------------------------------------------------

-- SECURITY DEFINER is load-bearing: this function reads public.users, which
-- itself has RLS enabled. Without DEFINER, any policy calling this would
-- recurse into the users policies and error.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' and status = 'active' from public.users where id = auth.uid()),
    false
  );
$$;

-- Creates the shadow `users` row whenever Supabase Auth creates an identity.
-- Students self-register as 'active'; faculty/admin are never self-service
-- and stay 'pending' until an admin approves them (PRD 5.1).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'student'
  );

  insert into public.users (id, email, role, status)
  values (
    new.id,
    new.email,
    requested_role,
    case when requested_role = 'student' then 'active'::public.account_status
         else 'pending'::public.account_status
    end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keeps `updated_at` honest without the application having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();

create trigger students_touch_updated_at
  before update on public.students
  for each row execute function public.touch_updated_at();

create trigger academic_profiles_touch_updated_at
  before update on public.student_academic_profiles
  for each row execute function public.touch_updated_at();

-- --- Row Level Security -----------------------------------------------------

alter table public.users                      enable row level security;
alter table public.students                   enable row level security;
alter table public.student_academic_profiles  enable row level security;
alter table public.student_languages          enable row level security;
alter table public.student_interests          enable row level security;
alter table public.student_goals              enable row level security;
alter table public.student_domains            enable row level security;
alter table public.consent_records            enable row level security;
alter table public.audit_logs                 enable row level security;
alter table public.departments                enable row level security;
alter table public.languages                  enable row level security;
alter table public.interests                  enable row level security;
alter table public.career_goals               enable row level security;
alter table public.technical_domains          enable row level security;

-- Reference tables: readable by any authenticated user. No write policy is
-- defined, so with RLS on, writes are denied to everyone except the service
-- role — which is exactly the intended state until the admin CRUD in PRD 5.6
-- ships.
create policy "reference read" on public.departments
  for select to authenticated using (true);
create policy "reference read" on public.languages
  for select to authenticated using (true);
create policy "reference read" on public.interests
  for select to authenticated using (true);
create policy "reference read" on public.career_goals
  for select to authenticated using (true);
create policy "reference read" on public.technical_domains
  for select to authenticated using (true);

-- users: a caller reads only their own shadow row; admins read all.
create policy "own user row" on public.users
  for select to authenticated using (id = auth.uid());
create policy "admin reads all users" on public.users
  for select to authenticated using (public.is_admin());

-- students: the core ownership boundary. `with check` on insert is what
-- actually authorises the registration write in ARCHITECTURE 6.1 step 4 —
-- the client is never trusted to supply someone else's user_id.
create policy "own student row" on public.students
  for select to authenticated using (user_id = auth.uid());
create policy "insert own student row" on public.students
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own student row" on public.students
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "admin reads all students" on public.students
  for select to authenticated using (public.is_admin());

-- Child tables: ownership is derived by joining back to students.user_id,
-- never taken from the request.
create policy "own academic profile" on public.student_academic_profiles
  for all to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_academic_profiles.student_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = student_academic_profiles.student_id and s.user_id = auth.uid()
  ));
create policy "admin reads academic profiles" on public.student_academic_profiles
  for select to authenticated using (public.is_admin());

create policy "own languages" on public.student_languages
  for all to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_languages.student_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = student_languages.student_id and s.user_id = auth.uid()
  ));
create policy "admin reads languages" on public.student_languages
  for select to authenticated using (public.is_admin());

create policy "own interests" on public.student_interests
  for all to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_interests.student_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = student_interests.student_id and s.user_id = auth.uid()
  ));
create policy "admin reads interests" on public.student_interests
  for select to authenticated using (public.is_admin());

create policy "own goals" on public.student_goals
  for all to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_goals.student_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = student_goals.student_id and s.user_id = auth.uid()
  ));
create policy "admin reads goals" on public.student_goals
  for select to authenticated using (public.is_admin());

create policy "own domains" on public.student_domains
  for all to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = student_domains.student_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.students s
    where s.id = student_domains.student_id and s.user_id = auth.uid()
  ));
create policy "admin reads domains" on public.student_domains
  for select to authenticated using (public.is_admin());

-- consent_records is append-only by design: select + insert policies exist,
-- update/delete have none, so nobody (bar the service role) can rewrite a
-- consent history.
create policy "own consent read" on public.consent_records
  for select to authenticated
  using (exists (
    select 1 from public.students s
    where s.id = consent_records.student_id and s.user_id = auth.uid()
  ));
create policy "own consent insert" on public.consent_records
  for insert to authenticated
  with check (exists (
    select 1 from public.students s
    where s.id = consent_records.student_id and s.user_id = auth.uid()
  ));
create policy "admin reads consent" on public.consent_records
  for select to authenticated using (public.is_admin());

-- audit_logs: admin-read-only. No insert policy — writes go through the
-- service role from server-side code only.
create policy "admin reads audit log" on public.audit_logs
  for select to authenticated using (public.is_admin());

-- --- Seed data --------------------------------------------------------------

insert into public.departments (code, name) values
  ('AIML', 'Artificial Intelligence & Machine Learning'),
  ('CSE',  'Computer Science & Engineering'),
  ('ECE',  'Electronics & Communication Engineering'),
  ('MECH', 'Mechanical Engineering'),
  ('ISE',  'Information Science & Engineering')
on conflict (code) do nothing;

insert into public.languages (name) values
  ('English'), ('Kannada'), ('Hindi'), ('Urdu'), ('Telugu'),
  ('Tamil'), ('Malayalam'), ('Marathi'), ('Bengali'), ('Arabic')
on conflict (name) do nothing;

insert into public.interests (name, category) values
  ('Programming', 'technical'),
  ('Robotics', 'technical'),
  ('Electronics & Circuits', 'technical'),
  ('Mathematics', 'academic'),
  ('Physics', 'academic'),
  ('Entrepreneurship', 'professional'),
  ('Public Speaking', 'professional'),
  ('Debate & Quizzing', 'cocurricular'),
  ('Sports & Athletics', 'cocurricular'),
  ('Music', 'arts'),
  ('Fine Arts & Design', 'arts'),
  ('Photography & Film', 'arts'),
  ('Social Service & NSS', 'community'),
  ('Writing & Journalism', 'arts')
on conflict (name) do nothing;

insert into public.career_goals (name) values
  ('IT / Software employment'),
  ('Core (non-IT) engineering employment'),
  ('GATE / Higher studies in India'),
  ('Study abroad (MS / MEng)'),
  ('Entrepreneurship / Startup'),
  ('Government / PSU services'),
  ('Research & Academia'),
  ('Civil services')
on conflict (name) do nothing;

insert into public.technical_domains (name) values
  ('Web Development'),
  ('Mobile App Development'),
  ('Data Science & Analytics'),
  ('Artificial Intelligence & ML'),
  ('Cybersecurity'),
  ('Cloud & DevOps'),
  ('Embedded Systems & IoT'),
  ('VLSI & Chip Design'),
  ('Robotics & Automation'),
  ('Mechanical Design & CAD'),
  ('Networking'),
  ('UI/UX Design')
on conflict (name) do nothing;
