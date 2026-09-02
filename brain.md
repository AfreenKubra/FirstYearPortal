# brain.md — fast orientation for this repo

Read this first, before grepping the whole tree. It's a map + the load-bearing
rules, not a copy of the real docs — go to those for depth:

- [`README.md`](README.md) — setup, scripts, features, migrations table, deploy
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system design, data model, request flows, risks
- [`PRD.md`](PRD.md) — product requirements, per-module status (shipped/planned)
- [`MANUAL-STEPS.md`](MANUAL-STEPS.md) — open decisions, known gaps, things a human still owes

**Update this file when you change something it describes** (new module, new
migration pattern, a rule that no longer holds) — it decays otherwise.

## What this is

Next.js 14 (App Router) + Supabase (Postgres/Auth/RLS) portal for HKBK
College of Engineering. Four roles — student, faculty, hod, admin — each with
their own route group and dashboard, sharing one student-directory
implementation underneath. TypeScript, Tailwind, Zod, Vitest.

Git: `origin` is the fork `s7oaib/FirstYearPortal`, `upstream` is
`AfreenKubra/FirstYearPortal`. Work on a branch and open a PR — merging
locally skips CodeRabbit, which is how ~5,000 lines already went unreviewed
(see MANUAL-STEPS §8).

## Where things live

```
src/app/(public)/     landing, login (+ /login/hod), register (+ /register/staff), reset, privacy
src/app/(student)/    dashboard, complete-profile, achievements, assessments, events, resources, roadmap
src/app/(faculty)/    dashboard, students, assessments, events, achievements, roadmaps
src/app/(hod)/        same shape as faculty, scoped to one department
src/app/(admin)/      accounts, assignments, departments, audit, reports, resources, students, vtu
src/middleware.ts     security layer 1: session/role/status/profile gate — see below

src/components/ui/          Button, Card, Field, FormStatus, Logo, HeroRoleSwitcher
src/components/directory/   filters, table, charts, profile view, dashboards — SHARED by faculty/hod/admin
src/components/marks/       MarksWorkspace + MarksGrid (staff, SHARED by faculty/hod),
                             StudentMarksTable (student view, rendered on /assessments),
                             SubjectTeacherForm (assign teachers; admin/vtu + hod/marks)
src/components/registration/ auth/ profile/ achievements/ assessments/ events/ resources/ roadmap/ admin/ vtu/
                             — one folder per feature area, form + display components

src/lib/supabase/     client.ts (browser), server.ts (RSC/actions + service-role), types.ts (HAND-WRITTEN)
src/lib/validation/   Zod schemas, shared client+server, one file per entity
src/lib/actions/      Server Actions — all mutations live here, one file per feature area
src/lib/queries/      Server Component reads, one file per feature area (directory.ts is the shared one)
src/lib/admin/        analytics aggregation
src/lib/assessments/  auto-grading logic
src/lib/events/       registration/capacity rules
src/lib/faculty/      filter parsing, CSV helpers
src/lib/resources/    bulk import, coverage, filters, recommendation matching
src/lib/roadmap/      generate.ts (rule-based), ai-generate.ts (Claude-backed), ai-schema.ts,
                       exam-track.ts, fingerprint.ts, link-providers.ts, links.ts, provider.ts, refresh.ts
src/lib/directory/    CSV export builder (provenance header, CSV-injection escaping)
src/lib/marks/        compute.ts — pure: sumRecorded, releasedOnly, pivotToComponents, validateMark
                       export.ts  — marks CSV builder (one row per student per subject)
src/lib/profile-completion.ts   pure fn: computes profile_completion_percent

src/config/            roles.ts, branding.ts, residence.ts, states.ts, achievements.ts,
                       assessments.ts, events.ts, resources.ts, roadmap.ts, notifications.ts,
                       marks.ts
                       — single source of truth, imported by UI + middleware + actions together

supabase/migrations/   0001..0028, strictly ordered SQL, see "Migrations" below
scripts/               migrate.mjs, check-schema.mjs, backfill-migrations.mjs,
                       sync-admins.mjs, seed-students.mjs, seed-resources.mjs
```

Unit tests live in `__tests__/` next to the code they test; `npm test` runs
them and needs no database. The RLS suite is the exception — it lives in
`tests/rls/`, has its own vitest config, needs a live DB, and runs via
`npm run test:rls`.

## Rules that must not be broken silently

1. **Three independent security layers** — middleware → Server Action →
   Postgres RLS. Adding a route or mutation means updating the relevant ones
   together; RLS is the backstop that holds even if the other two are missed.
2. **`src/lib/actions/*`** never trusts a client-supplied user/student id —
   every action re-derives the caller from `auth.getUser()` first, then
   scopes the write to that caller's own row. Copy this pattern for new
   actions, don't skip it.
3. **Roles are a set, not a scalar** (migration 0012). `users.role` = primary
   role (home route, label); `public.user_roles` = full granted set. Use
   `mergeRoles()` / `has_role()` — don't compare `users.role` alone when
   checking access.
4. **`admin` role is allow-list only**, enforced by a DB trigger
   (`admin_allowlist`, no INSERT policy) — never bypassable from the app.
   Mirrored copy in `src/config/roles.ts: ADMIN_ALLOWLIST` (UI-only, not the
   real enforcement).
5. **All staff visibility resolves through one function**,
   `can_faculty_view_student()` (Postgres). Adding a new staff-visible table
   or a new role variant should extend that function, not write a parallel
   policy. It has three branches now: HOD department, mentor assignment, and
   subject teacher (0026). Only the first two satisfy `p_mentor_only`, which
   is what keeps guardian contact masked from a subject teacher.
   **Editing marks is a separate question** — `can_edit_subject_marks()` —
   because a mentor may see a card they must not change.
6. **`components/directory/` + `lib/queries/directory.ts` is ONE
   implementation** shared by faculty/hod/admin. It takes no role/faculty-id/
   department param — scoping is 100% via RLS. Don't fork it per role; if a
   role needs different behavior, it's a copy/basePath difference in the page,
   not new query logic.
7. **Migrations are strictly ordered SQL, one transaction each.** `0010` (add
   enum value) and `0011` (use it) must run as separate statements/files —
   Postgres forbids using a new enum value in the same transaction that added
   it. Adding a migration ⇒ also add a probe in `scripts/check-schema.mjs`
   (it flags migrations it has no probe for).
8. **Roadmap generator "invents nothing"** — no fabricated course names,
   URLs, or syllabus content. AI path (`ai-generate.ts`) is schema-constrained
   (`ai-schema.ts`'s `submit_roadmap` tool has no free `url` field); links
   only come from the verified `resources` catalogue or a hardcoded provider
   domain whitelist (`link-providers.ts`). Falls back to the rule-based
   generator on any AI failure (`generateWithFallback`) — this must stay
   unconditional.
9. **`src/lib/supabase/types.ts` is hand-written**, not generated — expect it
   to lag the real schema; don't trust it blindly when debugging a type error
   that "shouldn't" happen. Regenerate with `supabase gen types` eventually.
10. **Service-role key** is read in exactly one file, `src/lib/supabase/server.ts`.
    Keep it that way — it must never reach a client bundle.
11. **Internal marks never compute a CIE total** (migration 0025). VTU's CIE
    formula varies by scheme and subject kind, so the portal only ever shows
    `SUM_LABEL` ("Sum of recorded components") from `src/config/marks.ts`.
    Same family of rule as the roadmap's "invents nothing". Also: a blank mark
    is *not* a zero — `sumRecorded()` skips unmarked components rather than
    counting them, and the UI renders `—`. Don't "helpfully" default to 0.
    The same rule governs analytics: `summariseMarks()` normalises each
    component against its own max (pooling a /20 IA with a /10 activity is
    meaningless) and skips unmarked rows, so an unmarked cohort never reads
    as a failing one.
12. **Marks components are a table, not an enum** (`mark_components`), so
    adding IA3 is a row. Deliberate — migrations 0010 and 0018 exist only
    because Postgres won't let a new enum value be used in the transaction
    that added it.

## Commands

```bash
npm run dev            # dev server
npm run build           # production build
npm run typecheck        # tsc --noEmit
npm run lint
npm test                 # vitest run (all src/**/__tests__/*) — fast, no DB
npm run test:rls         # RLS policy suite — needs a live DB + DATABASE_URL
npm run migrate:dry      # what's pending
npm run check:schema     # what the live DB is actually missing
npm run sync:admins -- --dry
npm run seed:students:dry
```

`npm run typecheck && npm run lint && npm test` is the fast pre-change sanity
check; `npm run build` before anything deploy-adjacent.

## Current known gaps (see MANUAL-STEPS.md for full detail/why)

- RLS is now covered for marks/subject_faculty/notifications by
  `npm run test:rls` (`tests/rls/`, own vitest config, real DB, fixtures
  created and torn down per run). **Every other table's policies are still
  unverified** — achievements, events, assessments, resources, roadmaps.
  Still no integration or e2e tests.
- Internal marks editing is restricted to the assigned subject teacher, the
  HOD of that department, and admins (migration 0026, `subject_faculty`).
  A subject with **no** teacher assigned falls back to HOD/admin only — a
  deliberate fallback so nothing is ever uneditable, but it means the marks
  subject picker is empty for a plain faculty member until an admin or HOD
  assigns them under **Admin → VTU scheme → Who teaches what**.
- **`vtu_subjects` is near-empty on the live DB** (one seeded subject,
  BMATS101, whose `official_url` is a placeholder needing correction), so the
  marks screens have little to mark against until an admin enters the real
  scheme under Admin → VTU scheme. Not a bug — same deliberate empty-start as
  the resource catalogue. The live DB also holds ~112 rows of **seeded demo
  marks** against real students; `delete from public.student_subject_marks;`
  clears them.
- Marks reporting exists for all three staff roles: `/faculty/reports`,
  `/hod/reports`, `/admin/reports` each offer a marks CSV
  (`{base}/marks/export`) plus the details CSV, which also carries three
  marks summary columns. All share `lib/marks/export.ts` and are scoped
  purely by RLS. Marks coverage is on the admin overview too
  (`summariseMarks` in `lib/admin/analytics.ts`), and releasing a component
  notifies each student (0027/0028) — a withdrawal is deliberately silent.
- PDF export not built (CSV only). Assessment timer not enforced (display
  only). Section-wise English scoring not built. Event certificates not
  built. Resource-performance-based recommendations not built (needs
  assessment results to exist first).
- Feature branches (assessment/events/resources/roadmap/notifications) were
  merged locally on 2026-08-19 without ever going through a PR/CodeRabbit
  review — ~5,000 lines, 17 RLS policies, 11 triggers, unreviewed. From here,
  branch + PR, don't merge locally.
- Auth endpoints have no rate limiting yet. Email verification enforcement
  is off (required for registration's current session-based flow to work).
- Not deployed yet.

## Tests-as-spec

`src/**/__tests__/*.test.ts` is often the fastest way to understand exact
expected behavior of a lib function (grading rules, filter parsing, roadmap
"invents nothing" checks, completion-percent edge cases) — cheaper to read
than re-deriving it from the implementation.
