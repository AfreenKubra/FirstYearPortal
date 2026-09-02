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

**Status: done on the current database. All 20 are applied and recorded.**

```bash
npm run migrate:dry     # "All 20 migration(s) already applied."
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

**Status: decided 2026-09-02. Claude/Anthropic, via `src/lib/roadmap/ai-generate.ts`.**

The roadmap generator interface (`src/lib/roadmap/provider.ts`) now has two
implementations behind it: the original rule-based one, and a Claude-backed
one. `resolveGenerator()` picks the AI generator whenever `ANTHROPIC_API_KEY`
is set and non-empty, and the rule-based one otherwise — which is still every
environment (a fresh clone, CI, a contributor's machine) that has not set one
up.

What the AI path does and does not see: exactly the same narrow fields the
rule-based generator already received — department, semester, goals, domains,
interests, rounded 10th/12th percentages, a bucketed verified-achievement
count, and any admin-entered VTU subjects. No name, USN, phone, guardian
contact, or date of birth, matching ARCHITECTURE 6.3's data-minimisation rule
for this feature.

The model is forced into a single tool call (`submit_roadmap`,
`src/lib/roadmap/ai-schema.ts`) rather than free-text parsing, and that
schema has no `url` field anywhere in it — see 3.4 below for why. A response
also has to pass the same "invents nothing" checks the rule-based generator's
own test suite asserts (no URL, no named course/certification/company, no
salary or placement figure, and every surviving rationale must literally name
one of the student's own inputs) before any of it is used; anything that
fails is dropped, and if dropping empties one of the three horizons the whole
response is rejected. PRD 5.10's fallback requirement is unconditional: an
unconfigured key, a timeout, a network error, or a response that fails
validation all land back on the rule-based generator, silently, rather than
an error page — `generateWithFallback` is what enforces this, and
`ai-generate.test.ts` proves it for every one of those failure modes.

Still open: nobody has reviewed Anthropic's data-handling terms for student
information formally, beyond the minimisation already described above. That
review should happen before this is relied on for real students at scale.

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

## 3.3 The mentor-review gate was removed

**Status: decided 2026-08-19. Recorded here because it reversed a stated
product guarantee.**

Roadmaps now regenerate whenever a student changes their profile and are
visible to them immediately. Previously migration 0016 made an unreviewed
plan invisible in RLS, and PRD section 2 promised "a roadmap a human mentor
has reviewed".

What replaced it:

- `auto` — the portal generated this from the student's profile and nobody
  has read it. This is what a student normally sees.
- `approved` — a mentor has read it and endorsed it.

Both are visible; the interface says which. Mentor review still exists as a
queue, it is simply no longer a gate.

**What still protects the student.** The generator invents nothing — no
course names, no certifications, no URLs, no salary or placement figures, and
no syllabus content beyond what an administrator entered from the official
VTU scheme. There are tests asserting the absence of each. That is now the
only safeguard between the generator and the student, so it matters more than
it did.

---

## 3.4 AI-suggested links are a deliberate, narrow exception to "invents nothing"

**Status: decided 2026-09-02. Scoped to `roadmap_milestone_links` only — never
to milestone prose.**

3.3 above says the generator invents nothing, and that guarantee is unchanged
for a milestone's `title`, `detail`, and `rationale` — the same regex and
named-entity checks still run against the AI path (3.1), on top of the
rule-based path's own test suite. What changed is that a roadmap can now also
carry concrete links to exams, workshops, courses, and certifications, from
two sources:

- **Catalogue links** (`attachCatalogueLinks`, `src/lib/roadmap/links.ts`) —
  always a real row from the admin-verified `resources` table (PRD 5.9),
  matched the same way the resources page ranks the catalogue for a student,
  narrowed to whatever a specific milestone's own rationale names. This half
  runs for every roadmap, rule-based or AI, and has no visible effect until an
  administrator populates `resources`.

- **AI-suggested links** (`attachAiSuggestedLinks`, same file) — the riskier
  half, chosen deliberately over restricting the model to the catalogue
  alone, so a roadmap can point somewhere useful even before an administrator
  has verified anything. The mitigation is structural, not a prompt
  instruction the model could ignore: `ai-schema.ts`'s `submit_roadmap` tool
  has no `url` field at all. The model can only supply a `provider` name and
  a search `keyword`; `src/lib/roadmap/link-providers.ts` deterministically
  builds the real URL from a small, hardcoded whitelist of real provider
  domains (NPTEL, SWAYAM, Coursera, edX, Udemy, LinkedIn Learning, AWS
  Certification, Google Certificates, Microsoft Certifications, HackerRank).
  An unrecognised provider name resolves to nothing — never a generic
  fallback link — and is dropped rather than guessed at.

  Government/board exams (GATE and similar) are deliberately **excluded**
  from the whitelist: their host domain changes across cycles, so a
  hardcoded template would eventually go stale and point somewhere wrong,
  which is worse than not linking. Time-bound exam links stay in the
  admin-verified catalogue, where a person updates them each cycle.

Every link is tagged in the database with `link_source` (`'catalogue'` or
`'ai_suggested'`) and shown to the student with a distinct badge
(`RoadmapView.tsx`) carrying `AI_SUGGESTED_LINK_NOTICE`
(`src/config/roadmap.ts`) — the domain is trustworthy by construction, but the
specific course or programme is not verified, and the student is told so.
Caps (2 links per milestone, 6 per roadmap, catalogue links always ordered
first) keep one enthusiastic response from burying a milestone's rationale.

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
| **Roadmaps** | Nobody — they generate themselves | Student → My roadmap |
| **VTU scheme subjects** | An administrator | Admin → VTU scheme |

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

**The VTU scheme starts empty, and roadmaps stay quiet about the syllabus
until it is filled.** The portal does not read vtu.ac.in — an explicit
non-goal — and the generator will not invent a subject name. Until an
administrator enters the scheme for a department and semester, plans for
those students simply say nothing about their subjects. That is the honest
output, not a bug. Entering one semester for one department takes a few
minutes and improves every plan in it from the students' next page view.

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

---

## 10. A psychometric visibility leak, found and fixed

**Status: fixed 2026-09-03 by `0030_psychometric_visibility_fix.sql`.
Recorded because it was a live breach of a stated product requirement, and
because the mistake behind it is easy to make again.**

PRD 5.7 says a psychometric result reaches the student and their assigned
mentor and nobody else, and calls that a requirement rather than optional
copy. From 0013 until 0030 that was not true: a faculty member assigned to a
student but deliberately **not** their mentor could read that student's
psychometric attempt, as long as they had not authored the paper — which is
the ordinary case.

The policy looked right. It said, in effect, "unless this assessment is
psychometric, or you are the mentor". The failure was in how RLS evaluates a
subquery:

> A subquery inside a policy runs with the **caller's** privileges, so it is
> filtered by RLS on the table it reads.

`assessments` is visible only to its author, that department's head, an
administrator, and targeted students. For anybody else the inner
`select 1 from assessments where kind = 'psychometric'` returned nothing, so
`exists` was false, `not exists` was **true**, and the psychometric branch was
skipped entirely.

**Negation is what made it dangerous.** `exists` over a table the caller
cannot read fails closed — it denies. `not exists` fails open — it grants. The
same dependency in `student_answers` used a join and so failed closed, which
was safe but wrong in the other direction: a genuine mentor who could not read
the assessment row was refused answers they were entitled to. Both now call
`is_psychometric_assessment()`, a `security definer` function that is not
subject to RLS.

**How it was found, and the lesson about the test.** The first version of the
test used a staff member with no relationship to the student at all. It
passed — and would have passed with the psychometric branch deleted, because
`can_faculty_view_student()` already refuses such a caller before the branch
is reached. Giving the fixture an assignment with `is_mentor = false` is what
made the assertion discriminate, and it failed on the first run. A test that
cannot fail for the reason it names is not evidence.

The rule to carry forward is in `brain.md`: never put a bare subquery over
another RLS-protected table inside a policy.
