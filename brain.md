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
implementation underneath. TypeScript, Tailwind, Zod, Vitest. No Git repo
detected at the working directory root (git commands won't apply here unless
one exists deeper/elsewhere).

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
src/lib/profile-completion.ts   pure fn: computes profile_completion_percent

src/config/            roles.ts, branding.ts, residence.ts, states.ts, achievements.ts,
                       assessments.ts, events.ts, resources.ts, roadmap.ts, notifications.ts
                       — single source of truth, imported by UI + middleware + actions together

supabase/migrations/   0001..0024, strictly ordered SQL, see "Migrations" below
scripts/               migrate.mjs, check-schema.mjs, backfill-migrations.mjs,
                       sync-admins.mjs, seed-students.mjs, seed-resources.mjs
```

Every `__tests__/` directory sits next to the code it tests (co-located, not
a top-level `tests/` tree). Run all of them with `npm test`.

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
   policy.
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

## Commands

```bash
npm run dev            # dev server
npm run build           # production build
npm run typecheck        # tsc --noEmit
npm run lint
npm test                 # vitest run (all __tests__/*)
npm run migrate:dry      # what's pending
npm run check:schema     # what the live DB is actually missing
npm run sync:admins -- --dry
npm run seed:students:dry
```

`npm run typecheck && npm run lint && npm test` is the fast pre-change sanity
check; `npm run build` before anything deploy-adjacent.

## Current known gaps (see MANUAL-STEPS.md for full detail/why)

- No integration/RLS/e2e tests — only unit tests (pure logic, validation,
  filters, grading, CSV escaping).
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
