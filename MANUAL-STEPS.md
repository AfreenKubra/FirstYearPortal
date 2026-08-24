# Manual steps and known gaps

Everything in this file needs a person. It is either something the code
cannot do for itself, something that needs a decision nobody has made yet, or
something deliberately left unbuilt with the reason recorded.

Kept separate from `README.md` because that file describes the product as it
stands; this one describes what is still owed.

Last updated 2026-08-19, after the five feature branches were merged into
`main` and the seeded student passwords were rotated.

---

## 1. Migrations

**Status: done on the current database. All 17 are applied and recorded.**

```bash
npm run migrate:dry    # "All 17 migration(s) already applied."
npm run check:schema   # probes the live catalog rather than the ledger
```

Adding a migration from here is one command: write the file, `npm run
migrate`. Add a probe for it in `scripts/check-schema.mjs` at the same time —
that script lists any migration it has no probe for, so an omission is
visible rather than silently reported as fine.

### Setting up a new environment

`DATABASE_URL` must be in `.env.local` (gitignored). Get it from the
dashboard's **Connect** button — not Project Settings, which no longer holds
it — and choose **Session pooler**, port `5432`.

Two traps, both of which cost time here:

- **Direct connection does not work** from an IPv4-only network. Its host is
  `db.<ref>.supabase.co` and it fails with `ENOTFOUND`. The pooler string is
  the one whose *username* contains the project ref
  (`postgres.<ref>`), which is the quickest way to tell them apart.
- **The `[YOUR-PASSWORD]` placeholder is literal.** Replace it, brackets
  included, with the database password — which is not the Supabase login, is
  shown only once at project creation, and can be reset under Project
  Settings → Database.

### If migrations were applied by hand first

The runner keeps its own ledger in `schema_migrations`. A database migrated
through the SQL Editor has no ledger, so the runner considers every file
pending and will fail trying to re-create objects that already exist.

```bash
npm run backfill:migrations -- --dry   # what it would record, and why
npm run backfill:migrations
```

It matches each migration to a signature object in the live catalog — a
table, column, policy, enum value, or function body — and records only what
it can actually confirm. Anything it cannot confirm is left for the runner.

That is not a formality. On this database it correctly found that
`0006_email_sync.sql` and `0008_approve_all_registrations.sql` had **never
been applied**, which nobody had noticed: students were self-registering as
`active` and skipping the approval queue entirely, contrary to what the PRD
and README both said.

**Why applying migrations cannot be automated from the app's own tooling:**
it is DDL, and the Supabase client libraries do not execute DDL. It needs a
direct Postgres connection or the dashboard. A service-role key deliberately
cannot restructure the schema.

---

## 2. Real student names are not in this repository

**Status: handled, but keep it that way.**

`scripts/seed-students.mjs` reads names from `students.local.json`, which is
gitignored. Create it in the project root:

```json
{
  "1HK24AI001": "Full Name",
  "1HK24AI002": "Another Name"
}
```

Any USN without an entry falls back to its own USN as the name, which the
student can correct once they sign in.

**Do not put real names back into a tracked file.** They were committed and
pushed once, on 2026-08-19, and the branch was rewritten to remove them. It
matters more here than in most projects: a seeded password is derived from
the USN, so a file containing name + USN is a file containing name + USN +
password.

If that combination ever reaches a public branch again, treat the seeded
passwords as compromised and rotate them:

```bash
npm run seed:students -- --reset-only --passwordSuffix '@SomethingNew'
```

`--reset-only` rotates accounts that exist without creating any that do not.
Use it rather than `--reset-passwords` for a rotation: USNs are not
contiguous — `1HK24AI008` and `017` were never issued — and a plain range run
would invent students for the numbers nobody was given.

---

## 3. Decisions nobody has made yet

### 3.1 AI provider for the roadmap

**Status: open. Blocks the AI half of PRD 5.10.**

The roadmap generator interface exists (`src/lib/roadmap/provider.ts`) and
every roadmap records `source`, `provider`, and `model`. Only the rule-based
implementation sits behind it.

What is needed before the AI path can be written:

- **Which provider**, and its data-handling terms for student information.
  This is a privacy decision, not a technical one — the prompt would carry a
  student's department, goals, domains, interests, and school marks.
- **An API key**, as a server-only environment variable. There is no
  `ANTHROPIC_API_KEY` or equivalent in `.env.local` today.

The rule-based generator is not a placeholder waiting to be replaced. PRD 5.10
requires a fallback that works when the provider is unavailable, so it has to
exist regardless — and it works with nothing configured.

### 3.2 Seeded student passwords

**Status: rotated on 2026-08-19. Still a handout scheme, not a security
boundary.**

The 28 seeded accounts (`1HK24AI001`–`030`, minus the two USNs never issued)
now use `<usn>@Hkbk2026` — so `1hk24ai001@hkbk.edu.in` signs in with
`1hk24ai001@Hkbk2026`. The previous scheme was `<usn>@hkbk`, which anyone
could compute from a registration number printed on an ID card. Those old
passwords no longer work; that was verified against three accounts after the
rotation.

The list lives in `student-credentials.local.csv` (gitignored) — USN, name,
email, password.

**What this did and did not fix.** A stranger holding a USN can no longer
derive the password. But every account shares one suffix, so anyone who
learns *one* student's password can derive all 28. That is acceptable for
credentials handed out on day one and expected to be changed; it is not
acceptable as a steady state.

Two ways to close it properly, in increasing order of effort:

- Tell students to change their password at first sign-in, and check that
  they have.
- Issue an independent random password per student. The seeder does not do
  this today — it is suffix-based by design — so it would need a small change
  and a different distribution method, since nothing would be derivable.

The password does satisfy the portal's own strength rules (lower, upper,
digit, symbol), so a student is not forced to change it by the validator
alone. Under the previous `@hkbk` suffix it failed the uppercase rule, which
happened to force the issue; that accidental safeguard is gone.

Two accounts are deliberately outside all of this and were never touched by
the rotation: `1HK23AI048` and `1HK26AI001`, both real people who set their
own passwords.

---

## 4. Data the portal is waiting for

These are not bugs. Features look empty until somebody puts something in.

| What | Who does it | Where |
|---|---|---|
| **Approving new accounts** | An administrator | Admin → Account approvals |
| **Faculty assignments** | An administrator | Admin → Faculty assignments |
| **Resource catalogue** | Faculty or an administrator | Admin → Resources |
| **Assessments** | Faculty or a HOD | Faculty → Assessments → New |
| **Events** | Faculty or a HOD | Faculty → Events → New |
| **Roadmaps** | A mentor, per student | A student's profile → Generate |

**Faculty assignments are the one that catches people out.** A faculty member
with no assignment rows sees an empty student directory and concludes the
filters are broken. They are not: `can_faculty_view_student()` returns false
for everyone until an assignment exists. Heads of department and
administrators do not need one.

**New student registrations now need approving.** Until
`0008_approve_all_registrations.sql` was applied (2026-08-19) students
self-registered as `active` and never appeared in the queue, despite the PRD
and README saying otherwise. That is fixed, and the consequence is real
workload: at the start of term every first-year student needs a decision,
concentrated into a few days. The queue sorts oldest-first so it is worked in
the order students joined. Existing accounts were not affected.

The resource catalogue ships **empty on purpose**. PRD 5.9 forbids fabricated
URLs and metadata, and a plausible-looking link nobody has opened is exactly
that. It is filled by people, and every entry shows as unchecked until an
administrator confirms it.

---

## 5. Placeholder data to correct

| Field | Current value | Why |
|---|---|---|
| `faculty.phone` for `hod.aiml@hkbk.edu.in` | `9999999999` | The account was created as an administrator only and had no phone; the column is NOT NULL and UNIQUE, so migration 0012 had to write something |
| Seeded students' `phone` | `90000000NN` | Placeholders, unique and well-formed, so the unique constraint holds |
| Seeded students' `guardian_phone` | `91000000NN` | As above |
| Seeded students' `guardian_name` | `To be updated` | As above |
| Institution logo | `public/hkbk-logo.png` | Confirm this is the official asset |

Students can correct their own contact details; the HOD phone needs an
administrator.

---

## 6. Built deliberately narrower than the PRD

Each of these is a considered scope decision rather than an oversight.

### PDF export (5.11)
CSV only. PDF needs a document-generation dependency, and adding one is a
decision worth making deliberately rather than on the way past. CSV opens in
Excel and Sheets and covers the reporting need.

### Section-wise English scoring (5.7)
An English assessment is carried as its own kind but scores as one total
rather than by section. No CEFR level is claimed anywhere, which was the
constraint that actually mattered.

### Assessment timer (5.7)
`duration_minutes` is displayed but not enforced. Enforcing it properly means
handling clock skew, tab closes, and network drops without ever destroying a
student's work — that deserves its own design pass rather than a
`setTimeout`.

### Broadcast notifications on event publication (5.11)
Notifications are raised for events that concern one person: an achievement
verified, an attempt marked, a waiting-list place opening, a roadmap
approved. Publishing an event to a whole department is a fan-out to hundreds
of rows in one trigger, which needs batching rather than a row-level insert.

### Certificates for event attendees (5.8)
Needs document generation and a storage bucket. Attendance is recorded, so
the data a certificate would draw on exists.

### Recommendations from assessment performance (5.9)
Resources match on department, interests, goals, and domains. Matching on
assessment results needs results to exist first.

---

## 7. Things worth doing before real students use this

- **Rate limiting on authentication endpoints.** Not implemented. Noted in
  `README.md` under known limitations.
- **Email verification enforcement.** Registration currently depends on
  Supabase's "Confirm email" being *off*, because the student record is
  written using the session `signUp` returns.
- **Regenerate `src/lib/supabase/types.ts`.** It is hand-written and now
  mirrors seventeen migrations. `supabase gen types typescript` would remove a
  whole class of drift.
- **Integration and RLS-policy tests.** The 222 unit tests cover pure logic
  only. The RLS policies have been verified by hand against the live database
  several times, but nothing re-checks them automatically.
- **Separate Supabase projects** for development and production. There is one
  today, and it now holds real student names.

---

## 8. The feature branches are merged — and were never reviewed

All five landed on `main` on 2026-08-19 as a single fast-forward, because the
stack was linear:

`assessment-engine` → `events-module` → `resources-module` →
`roadmap-module` → `notifications-module`

**No pull request was ever opened for any of them, so CodeRabbit reviewed
none of it.** CodeRabbit only reviews pull requests; a local merge skips it
entirely. That is roughly 5,000 lines — the assessment engine, events,
resources, roadmaps, and notifications — carrying seventeen RLS policies and
eleven database triggers, none of which a second pair of eyes has seen.

The branches still exist on the remote, so any of them can be opened as a
pull request against a scratch branch later if you want the review
retrospectively.

From here, put changes on a branch and open a PR rather than merging locally,
or that gap keeps widening.

---

## 9. Deployment

Not deployed yet. When it goes to Vercel:

- Set exactly three environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Do not set `DATABASE_URL`.** It appears only in `scripts/`, never in
  `src/`, and it carries the database password. The running app has no use
  for it.
- Update **Supabase → Authentication → URL Configuration**: Site URL to the
  Vercel domain, and add `https://<app>.vercel.app/**` to Redirect URLs.
  Keep `http://localhost:3000/**` so local development still works. Skip this
  and password reset silently sends people to localhost.

`SUPABASE_SERVICE_ROLE_KEY` is read in exactly one file,
`src/lib/supabase/server.ts`, which is not a client component — so it does
not reach the browser bundle. Worth re-checking if that file is ever split.

Deploying makes real student data reachable from the public internet: names,
marks, and guardian phone numbers for 30 first-years. Decide deliberately
whether this deployment should point at the production Supabase project or a
separate one holding demo data.
