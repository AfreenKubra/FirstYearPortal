# First-Year Student Development and Analytics Portal

A role-based web portal that gives HKBK College of Engineering a single,
structured record of every first-year student — and turns it into filterable
analytics for faculty and administrators.

Built with Next.js 14 and Supabase, with access boundaries enforced at three
independent layers.

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e)
![Tests](https://img.shields.io/badge/tests-89%20passing-brightgreen)

---

## The problem

Academic background, interests, career goals, and mentoring activity for
first-year students were spread across paper forms and spreadsheets. Faculty
could not quickly find the students who needed support, and the institution
could not report on outcomes without manual collation.

This portal collects a complete structured profile from every student once,
then makes that data queryable — under strict role boundaries. A student can
never see another student's record. A faculty member sees only the students
assigned to them. Guardian contact details are visible only to a student's
assigned mentor.

## Features

### Student

- Three-step registration with live validation (USN format, unique
  email/phone/username, password strength, recorded consent)
- Mandatory profile gate — the dashboard stays locked until academic
  background, interests, career goals, and technical domains are all saved
- Section-by-section saving, so an interrupted session loses nothing
- Live completion percentage with a milestone breakdown of what remains
- Dashboard: academic summary, residence, interests, goals, domains, contact

### Faculty

- Dashboard scoped to assigned students: counts, completion rate, and
  distributions by department, semester, quota, and residence type
- Student directory with eleven combinable filters, search, and pagination
- Filter state lives in the URL, so any view is linkable and shareable
- Full authorised profile for any assigned student
- CSV export carrying a provenance header — who exported, when, and which
  filters produced the file
- Students flagged for follow-up, least-complete profile first

### Administrator

- Institution-wide analytics and a side-by-side department comparison
- Account approval queue for faculty and administrator requests
- Faculty assignment management — by department/semester/section scope or by
  named student, with a separate mentor flag
- Department management, without a deploy
- Append-only audit log of every privileged action
- Institution CSV report

## Security model

Three independent layers, each able to deny access on its own. No layer is
trusted alone.

| Layer | Where | Enforces |
|---|---|---|
| **1. Middleware** | [`src/middleware.ts`](src/middleware.ts) | Session exists; `role`/`status` read live from the database, not the JWT, so a suspension takes effect on the next request; cross-role access redirected; incomplete student profiles sent back to the gate |
| **2. Server Actions** | [`src/lib/actions/`](src/lib/actions/) | Every mutation re-derives the caller's identity from their session. A client may post any id it likes and still writes only its own row |
| **3. Postgres RLS** | [`supabase/migrations/`](supabase/migrations/) | Policies key off `auth.uid()`. Faculty visibility resolves through a single `can_faculty_view_student()` function reused by every policy |

Additional measures:

- **Column-level guardian masking.** RLS controls which *rows* are visible but
  cannot mask a column. A `security_invoker` view resolves guardian contact to
  `NULL` unless the caller is the assigned mentor or an administrator — so the
  CSV export cannot leak what the screen hides.
- **Audit entries are written with the service role**, which no browser
  session holds. An action cannot be performed without leaving a record.
- **Immutable columns.** A trigger pins `users.id` and constrains
  `users.email` to match the auth identity.
- **CSV injection defence.** Cells beginning `=`, `+`, `-`, or `@` are escaped
  before export.
- **No account enumeration.** Login and password-reset responses do not reveal
  whether an address is registered.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript, React 18 |
| Styling | Tailwind CSS with a custom indigo/brass token set |
| Backend | Next.js Server Actions and Server Components |
| Database | PostgreSQL via Supabase, with Row Level Security |
| Auth | Supabase Auth (email/password) |
| Validation | Zod schemas shared between client and server |
| Testing | Vitest |

## Getting started

### Prerequisites

- Node.js 20 or newer
- A Supabase project (the free tier is sufficient)

### 1. Install

```bash
git clone https://github.com/AfreenKubra/FirstYearPortal.git
cd FirstYearPortal
npm install
```

### 2. Apply the database migrations

In the Supabase dashboard, open **SQL Editor** and run each file in
[`supabase/migrations/`](supabase/migrations/) in order:

| Migration | Adds |
|---|---|
| `0001_init_mvp.sql` | Core schema, enums, signup trigger, student RLS, seed reference data |
| `0002_public_reference_read.sql` | Lets the unauthenticated registration page read departments and languages |
| `0003_faculty.sql` | Faculty records, assignment scoping, faculty RLS, guardian-masking view |
| `0004_admin.sql` | Admin records, admin write policies, immutable-column guard |
| `0005_staff_registration.sql` | Lets a pending administrator create their own profile row |
| `0006_email_sync.sql` | Keeps `users.email` in step with Supabase Auth |
| `0007_residence_type.sql` | Replaces the two-value accommodation field with four residence types |
| `0008_approve_all_registrations.sql` | Every new account starts `pending`, students included |

Once `DATABASE_URL` is configured (below), later migrations can instead be
applied with:

```bash
npm run migrate        # apply anything pending
npm run migrate:dry    # list what would run, change nothing
```

### 3. Disable email confirmation

**Authentication → Sign In / Providers → Email → uncheck "Confirm email".**

Registration writes the student record using the session that `signUp`
returns. With confirmation enabled there is no session at that moment, so the
profile cannot be created. Enforcing verification properly is planned work.

### 4. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API | Public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API | Public by design — every query it makes is RLS-constrained |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API | **Server-only.** Bypasses RLS. Never prefix with `NEXT_PUBLIC_` |
| `DATABASE_URL` | Settings → Database | Optional; only needed for `npm run migrate` |

`.env.local` is gitignored. Never commit real credentials.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

### 6. Create the first administrator

Administrator accounts are never self-service, which leaves the first one to
be created by hand, once.

1. Register at `/register/staff` and select **Administrator**.
2. Activate that account:

```sql
update public.users
   set status = 'active'
 where email = 'your-admin@example.com'
   and role = 'admin';
```

Every administrator after the first is approved inside the portal, under
**Account approvals**.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run migrate` | Apply pending database migrations |

## Project structure

```
src/
  app/
    (public)/          landing, login, register, staff register, password reset, privacy
    (student)/         dashboard, complete-profile
    (faculty)/         dashboard, student directory, student detail, CSV export
    (admin)/           overview, approvals, assignments, departments, audit, export
    auth/callback/     Supabase email-link exchange
  components/
    ui/                Button, Field, Card, ProgressBar, Logo, FormStatus
    layout/            AuthShell, role navigation
    registration/      student and staff registration forms
    faculty/           filters, distribution charts
    admin/             approval, department, and assignment forms
  lib/
    supabase/          browser, server, and service-role clients; hand-written types
    validation/        Zod schemas shared client and server
    actions/           Server Actions (all mutations)
    queries/           read paths for student, faculty, and admin
    faculty/           filter parsing and CSV helpers
    admin/             analytics aggregation
    profile-completion.ts   pure, unit-tested completion logic
  config/              branding, departments, residence types, states
  middleware.ts        session, role, status, and profile gate
supabase/migrations/   ordered SQL migrations
scripts/migrate.mjs    migration runner
```

## Testing

```bash
npm test
```

89 unit tests covering profile-completion gate logic, every validation schema,
directory filter parsing, CSV escaping, and analytics aggregation.

Integration, RLS-policy, and end-to-end tests are planned.

## Deployment

The app deploys to Vercel with no configuration beyond environment variables.

1. Import the repository in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` under **Settings → Environment Variables**.
3. Deploy.

Use separate Supabase projects for development and production once the data
is real rather than demo.

## Project status

| Area | Status |
|---|---|
| Authentication and account lifecycle | Complete |
| Student registration and mandatory profile | Complete |
| Student dashboard | Complete |
| Faculty dashboard, directory, filters, export | Complete |
| Admin analytics, approvals, assignments, departments, audit | Complete |
| Achievements | Not started |
| Assessment engine | Not started |
| Events | Not started |
| VTU resources and certification recommendations | Not started |
| AI development roadmap | Not started |
| Notifications and reporting | Not started |

See [`PRD.md`](PRD.md) for full product requirements and
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the system design.

## Known limitations

- Authentication endpoints are not yet rate-limited.
- Supabase types in [`src/lib/supabase/types.ts`](src/lib/supabase/types.ts)
  are hand-written; regenerate with `supabase gen types` once the schema
  settles.
- `@supabase/ssr` must stay in step with `@supabase/supabase-js`. Older `ssr`
  releases call `SupabaseClient<Database, SchemaName, Schema>`, but
  supabase-js ≥ 2.7x redefined that second generic. A mismatch makes every
  query result resolve to `never` at the type level while still compiling.
- The institution logo is a monogram placeholder.
- Psychometric assessment features, when built, are for self-development and
  mentoring only — never clinical assessment, and never a basis for denying a
  student any opportunity.

## License

Released under the [MIT License](LICENSE).
