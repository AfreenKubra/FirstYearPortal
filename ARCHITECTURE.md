# Architecture

**Product:** First-Year Student Development and Analytics Portal
**Scope of this document:** the system as designed for the full spec, with
the current build status of each piece marked explicitly. See `PRD.md` for
product requirements and `README.md` for local setup.

---

## 1. System overview

```
                         ┌─────────────────────────┐
                         │        Browser           │
                         │  Next.js client (React)  │
                         └────────────┬─────────────┘
                                      │ HTTPS
                 ┌────────────────────┼────────────────────┐
                 │                    │                     │
        Server Components      Server Actions         Middleware
        (data reads, RSC)      (mutations)             (route guard)
                 │                    │                     │
                 └────────────────────┼─────────────────────┘
                                      │  Supabase client
                                      │  (user session, RLS-scoped)
                                      ▼
                       ┌───────────────────────────┐
                       │   Supabase (Postgres)      │
                       │  Auth · DB · RLS · Storage │
                       └──────────────┬─────────────┘
                                      │ (server-only, service role,
                                      │  narrow & audited use only)
                                      ▼
                       ┌───────────────────────────┐
                       │  AI provider (server-only) │
                       │  roadmap generation         │
                       │  + rule-based fallback      │
                       └───────────────────────────┘
```

Everything the browser talks to is either a Next.js server boundary
(Server Component render, Server Action, or Route Handler) or Supabase
directly using the **anon key**, which is always subject to Row Level
Security. The **service-role key** never reaches the client and is used
server-side only for a short, deliberately audited list of privileged
operations (account approval, bulk admin actions) — not for general reads.

## 2. Technology stack

| Layer | Choice | Status |
|---|---|---|
| Frontend framework | Next.js 14 (App Router), TypeScript | Shipped |
| Styling | Tailwind CSS, custom academic token set (indigo/brass) | Shipped |
| Forms & validation | React Hook Form + Zod, shared client/server schemas | Shipped |
| Backend | Next.js Server Actions (mutations), Server Components (reads) | Shipped for student slice |
| Database | PostgreSQL via Supabase | Shipped (MVP schema) |
| Auth | Supabase Auth (email/password) | Shipped |
| Storage | Supabase Storage (profile photos, achievement evidence) | Planned, schema-ready |
| AI | Server-only call to an LLM provider + rule-based fallback | Planned |
| Charts | Recharts (or equivalent) | Planned |
| Reports | CSV + PDF export | Planned |
| Testing | Vitest (unit) | Shipped; integration/e2e planned |
| Deployment | Vercel (app) + Supabase (data) | Documented, not yet deployed |

## 3. Layered security model

Three independent layers, each capable of blocking access on its own:

1. **Middleware (`src/middleware.ts`)** — runs on every request to a
   protected path. Confirms a session exists, reads `role`/`status` from
   the `users` shadow table, blocks suspended/rejected accounts, redirects
   cross-role access attempts (a student hitting `/faculty/*` is bounced
   before the page ever renders), and redirects incomplete student profiles
   to `/complete-profile`. **Shipped.**

2. **Server actions / route handlers** — every mutation independently
   re-derives the caller's identity from their session (never trusts a
   client-supplied user ID) and checks ownership before writing. See
   `src/lib/actions/profile.ts` for the pattern: resolve `auth.getUser()` →
   look up the caller's own `students` row → operate only on that row's
   children. **Shipped for the profile-completion actions; the same
   pattern is the template for every future mutation.**

3. **Postgres Row Level Security** — the backstop that holds even if a
   middleware or server-action check is ever missed. Every table with
   student data has RLS enabled; policies key off `auth.uid()` compared
   against `students.user_id`, with a `current_user_role()` helper function
   for admin-wide read policies. **Shipped for all tables.** All staff
   visibility resolves through the single `can_faculty_view_student()`
   function (migration 0003, widened in 0011) that section 11 asked for —
   which is why adding the HOD role meant editing one function body rather
   than a dozen policies across three migrations.

No layer is trusted alone. When new routes/mutations are added, all three
layers need updating together.

## 4. Role/permission model

| | Student | Faculty | HOD | Admin |
|---|---|---|---|---|
| Own profile: read/write | ✅ | – | – | – |
| Other students: read | ❌ | ✅, scoped to assignment | ✅, own department | ✅, all |
| Verify achievements | ❌ | ✅, assigned students | ✅, own department | ✅ |
| Create/assign assessments | ❌ | ✅ (planned) | ✅ (planned) | ✅ (planned) |
| Guardian contact fields | ✅ own record only | ⚠️ masked unless assigned mentor | ✅, own department | ✅ |
| Manage departments/resources | ❌ | ❌ | ❌ | ✅ |
| Approve accounts, change roles | ❌ | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ❌ | ✅ |

`role` and `status` live on the `users` shadow table (1:1 with
`auth.users`), never on the JWT alone, so a role change takes effect
immediately without waiting for token refresh — every check re-reads the
table.

**Roles are a set, not a single value** (migration 0012). The institution's
real structure needs it: the head of AIML is also a portal administrator, and
the portal administrator also teaches, and each of them could previously reach
only one of their two portals. `users.role` remains the *primary* role — the
home route and the label — while `public.user_roles` holds the full set that
grants access. A trigger keeps the primary role inside the set, so no caller
has to consult two sources.

The join table was chosen over a `roles text[]` column because a column would
have to be kept in step with `users.role` by hand and every policy would need
to unnest it. `has_role()` then let `is_admin()`, `current_hod_department()`,
and `current_faculty_id()` be redefined *in place* — same names, same
signatures — so not one of the policies written against them had to change.

**Head of Department** is a role, not a job title. A HOD's profile lives in
the same `faculty` table as a mentor's — they are teaching staff with a
department — and what separates them is `users.role = 'hod'`, which is what
`current_hod_department()` keys off. One staff table rather than a
near-duplicate `hods` is what lets every existing faculty-scoped policy pick
HODs up without being rewritten.

**Administrator is allow-list-only** (migration 0011). It is the one role with
institution-wide reach, and `handle_new_auth_user` takes the requested role
from signup metadata — so before the allow-list, a stranger could register
asking for `role: 'admin'` and appear in the approvals queue as a legitimate
request. A `before insert or update` trigger on `public.users` now refuses any
write setting `role = 'admin'` for an address absent from
`public.admin_allowlist`, and that table has no INSERT policy, so it cannot be
widened from inside the application at all.

## 5. Data model

### 5.1 Shipped schema (`supabase/migrations/0001_init_mvp.sql`)

```
auth.users (Supabase-managed)
   │ 1:1 (trigger-created on signup)
   ▼
users (id, email, role, status, last_login_at)
   │ 1:1
   ▼
students (id, user_id, full_name, dob, usn, phone, email, state, city,
          department_code → departments, guardian_name, guardian_phone,
          username, profile_photo_url, accommodation,
          profile_completion_percent, consent_given_at)
   │
   ├── student_academic_profiles (1:1)   — 10th/12th %, quota, rank, semester, section, year
   ├── student_languages (1:N)           — → languages lookup
   ├── student_interests (1:N)           — → interests lookup
   ├── student_goals (1:N)               — → career_goals lookup
   ├── student_domains (1:N)             — → technical_domains lookup
   └── consent_records (1:N)             — append-only consent log

departments, languages, interests, career_goals, technical_domains
   — public-read reference tables, admin-writable (write policy: planned)

audit_logs — append-only, admin-read-only, actor_user_id → users
```

Design choices worth calling out:

- **Lookup tables over enums for languages/interests/goals/domains.** The
  original brief requires these to be extendable without code changes
  (e.g. departments must be a configurable table, not a hard-coded list).
  The same reasoning was applied to languages/interests/goals/domains so
  admins can add options later via a data migration, not a deploy.
- **`profile_completion_percent` is a derived, stored value**, recomputed
  by `computeCompletionPercent()` (pure function, unit-tested) after every
  section save, rather than computed on every read — cheaper for dashboard
  and middleware checks, at the cost of needing to keep writes and the
  recompute call together (they currently are, inside the same server
  action).
- **`user_id` on `students`, not `id`, is the FK Supabase Auth cares
  about** — `students.id` is a separate surrogate key so other tables
  (achievements, assessments, etc. in later phases) reference the academic
  record, not the auth identity, keeping auth concerns and academic-record
  concerns decoupled.

### 5.2 Planned schema (later migrations, per PRD Section 5)

`faculty`, `admins`, `faculty_student_assignments`, `mentoring_notes`,
`achievements`, `achievement_documents`, `assessments`, `questions`,
`question_options`, `assessment_assignments`, `assessment_attempts`,
`student_answers`, `assessment_results`, `events`, `event_registrations`,
`attendance`, `resources`, `course_recommendations`, `student_roadmaps`,
`roadmap_milestones`, `notifications`, `saved_filters`, `report_history`.

Each of these needs: RLS policies scoped by the new
`faculty_student_assignments` table, indexes on the columns the filter UI
(PRD 5.5) will query most, and — for anything holding guardian or
psychometric data — an explicit masking policy, not just an access policy.

## 6. Request/data flow examples

### 6.1 Student registration (shipped)
1. Client validates the multi-step form with the shared Zod schema
   (`src/lib/validation/student.ts`) — same schema will run server-side
   once registration moves to a server action in a later hardening pass.
2. Client calls `supabase.auth.signUp()` — creates `auth.users` row.
3. A Postgres trigger (`handle_new_auth_user`) creates the matching `users`
   shadow row with `role='student'`, `status='pending'`.
4. Client (now holding a session) inserts into `students`,
   `student_languages`, and `consent_records` directly — RLS's
   `with check (user_id = auth.uid())` is what actually authorises this,
   not client-side trust.
5. Redirect to `/complete-profile`.

### 6.2 Mandatory profile completion (shipped)
1. `complete-profile` page (Server Component) fetches the student's
   current section data.
2. Each section is its own `<form action={serverAction}>` — progressive
   enhancement, works without client JS.
3. The server action re-resolves the caller's own `student_id` (never
   trusts a client-supplied ID), validates with Zod, upserts, then calls
   `computeCompletionPercent()` and writes the new percentage.
4. `revalidatePath` refreshes both `/complete-profile` and `/dashboard`.
5. Middleware re-checks `profile_completion_percent` on the next
   `/dashboard` request and only then lets the student through.

### 6.3 AI roadmap generation (planned)
1. Server action gathers the minimum necessary profile fields (not the
   full row — guardian contact, for instance, is never sent) into a
   structured prompt.
2. Call to the LLM provider happens server-side only; the API key is never
   in a client bundle.
3. Response is parsed into the `student_roadmaps` / `roadmap_milestones`
   shape, tagged with model/provider/version, and saved with
   `approval_status = 'pending_mentor_review'`.
4. If the provider call fails or times out, a rule-based fallback
   generator (deterministic, from department + goals + domains) produces a
   roadmap instead of failing the request outright.
5. Faculty mentor reviews via the faculty dashboard (planned) and
   approves/edits before the student sees it as final.

## 7. Frontend structure

```
src/
  app/
    (public)/        landing, register, login, /login/hod, forgot/reset-password, privacy
    (student)/        layout.tsx (sidebar shell) + dashboard, complete-profile, achievements
    (faculty)/        dashboard, student directory, detail, export, verification queue
    (hod)/            the same shape, scoped to one department
    (admin)/          overview, students, approvals, roles, assignments, departments, audit
  components/
    ui/               Button, Field (TextInput/Select), Card/ProgressBar — design-token driven
    registration/      RegisterForm (multi-step)
    auth/              LoginForm, LogoutButton
    profile/           ProfileSectionForm (generic renderer driven by field defs)
  lib/
    supabase/          client.ts (browser), server.ts (RSC/actions + admin), types.ts (hand-written, regenerate later)
    validation/        Zod schemas, shared client/server
    actions/           Server Actions (mutations)
    profile-completion.ts   pure, unit-tested completion-percent helper
  middleware.ts         role/session/profile-gate
  config/branding.ts     institution config (name, logo, departments, contacts)
```

Route groups `(public)` / `(student)` / `(faculty)` / `(hod)` / `(admin)`
don't affect the URL — `/dashboard` is `/dashboard` regardless of which group
folder it lives in — they exist purely to attach a shared `layout.tsx` per
role, which is where the sidebar/nav differs.

**The three staff directories are one implementation.** `components/directory/`
holds the filters, table, charts, profile view, dashboard, and verification
queue; `lib/queries/directory.ts` holds the reads. None of it takes a role, a
faculty id, or a department — scoping comes entirely from RLS, so the same
`listStudents(filters)` call returns a mentor's assignments, a HOD's
department, or the whole institution depending only on who is asking. The
pages differ in their copy and their `basePath`.

A note on the role shells: each layout re-checks its own role independently of
middleware and, when the profile row is missing, redirects to
`/account-blocked` rather than `/login`. Sending them to `/login` produced a
redirect loop — middleware bounces an authenticated staff session straight
back to the role home, which redirects to `/login` again — that a user
experienced as a dead browser tab.

## 8. Design system

Tokens live in `tailwind.config.ts`: an indigo/brass academic palette
(chosen deliberately over generic cream/terracotta AI-default styling —
see `frontend-design` guidance) plus a serif display face for headings and
a grotesk body face. The signature UI motif is the milestone-style
`ProgressBar` (`src/components/ui/Card.tsx`), echoing the roadmap's
30-day/3–6-month/1–4-year milestone structure that the rest of the product
is built around.

## 9. Testing strategy

| Test type | Status | Location |
|---|---|---|
| Unit — validation schemas | Shipped | `src/lib/validation/__tests__` |
| Unit — completion-percent logic | Shipped | `src/lib/__tests__` |
| Unit — role table, allow-list, route coverage | Shipped | `src/config/__tests__` |
| Schema drift — which migrations the live DB is missing | Shipped | `scripts/check-schema.mjs` |
| Integration — auth/API | Planned | — |
| RLS policy tests | Planned | — |
| E2E — critical workflows (PRD-referenced 12 scenarios) | Planned | — |
| Accessibility | Manual pass done on shipped pages (focus states, labels, contrast); automated a11y testing planned | — |

`npm run typecheck`, `npm run lint`, `npm run build`, and `npm test` all
currently pass against the shipped slice; none are wired into CI yet.

## 10. Deployment topology

- **App:** Vercel, one production + preview deployments per PR.
- **Data:** Supabase project (Postgres + Auth + Storage), migrations
  applied via SQL Editor or `supabase db push`, one project per
  environment (recommend separate dev/staging/prod Supabase projects once
  faculty/admin data is real, not demo data).
- **Secrets:** `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are public by design;
  `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are server-only
  environment variables, set in Vercel's dashboard, never committed.

## 11. Key risks / decisions to revisit

- **RLS policy growth — resolved, and it paid off.** The single
  `can_faculty_view_student(student_id)` function this section originally
  proposed is now the only place staff visibility is decided, and every
  faculty-scoped policy across migrations 0003 and 0009 calls it. Adding the
  Head of Department role in 0011 therefore meant adding one branch to one
  function; no policy changed. The cost to watch is the opposite one: the
  function is now on the hot path of every student-facing query, so if the
  branches keep multiplying it becomes the thing to profile first.
- **`can_faculty_view_student`'s HOD branch ignores `p_mentor_only`,** which
  is what drives guardian masking, so a head of department sees guardian
  contact for their whole department. That is deliberate — they are who has to
  ring a guardian when a student stops attending — but it is a genuine
  widening of the PRD's original "assigned mentor only" rule, and it should be
  revisited if departments grow large enough that "head of department" stops
  meaning one accountable person.
- **Hand-written Supabase types:** `src/lib/supabase/types.ts` must be
  regenerated from the real schema once it stabilizes; the current
  hand-written version is a deliberate stopgap and already required one
  non-obvious fix (`Relationships: []` on every table) to satisfy the
  installed `postgrest-js` version's generic constraints — future schema
  additions should go through `supabase gen types` rather than more manual
  edits.
- **AI provider selection** affects both the fallback design and the data
  minimisation approach (Section 6.3) — needs a decision before Phase 4.
