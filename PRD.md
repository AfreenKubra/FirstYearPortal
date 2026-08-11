# Product Requirements Document

**Product:** First-Year Student Development and Analytics Portal
**Institution:** HKBK College of Engineering, Bengaluru (affiliated to VTU)
**Doc status:** Living document — MVP (Foundation phase) shipped; remaining phases scoped below
**Owner:** Portal Administrator, HKBK College of Engineering

---

## 1. Purpose and background

HKBK College of Engineering enrols first-year students across five
departments (AIML, CSE, ECE, Mechanical, ISE) under VTU affiliation. Today,
academic background, interests, career goals, achievements, and mentoring
activity for these students are not captured in one system, which makes it
hard for faculty to identify students who need support and for the
institution to report on outcomes.

This portal exists to:

1. Collect a complete, structured profile from every first-year student once.
2. Give faculty and admins real-time, filterable analytics over that
   population instead of manual spreadsheet work.
3. Turn each student's profile and assessment results into an explainable,
   mentor-reviewed **individual development roadmap**.
4. Provide the assessment, event, resource, and reporting infrastructure a
   mentoring program needs to run day to day.

## 2. Goals and non-goals

### Goals
- Every first-year student completes a structured profile before using the
  rest of the portal.
- Faculty can find and understand any assigned student in under a minute
  using filters, not manual searching.
- Admins can see department-wise and institution-wide analytics without
  exporting data to another tool.
- Every student receives a roadmap that a human mentor has reviewed, not an
  unreviewed AI output.
- All of the above works within strict, auditable role boundaries — a
  student can never see another student's data; a faculty member can never
  see students outside their assignment; only admins see everything.

### Non-goals (explicitly out of scope)
- This is not a Learning Management System (no course content delivery,
  grading of coursework, or attendance-taking for classes).
- This is not a general-purpose CRM or ticketing system for faculty.
- Psychometric assessments are for self-development and mentoring only —
  the product will never present them as, or use them for, clinical/medical
  diagnosis or as a basis to deny any opportunity to a student.
- The portal does not scrape or mirror external sites (VTU syllabus, NPTEL,
  etc.); it stores and links to admin-verified references only.

## 3. Users and roles

| Role | Who | Core need |
|---|---|---|
| **Student** | First-year VTU students at HKBK | Complete profile once, track progress, get a roadmap and recommendations |
| **Faculty** | Assigned mentors/department faculty | Find and understand assigned students; verify achievements; run assessments/events; mentor at scale |
| **Admin** | Department heads, portal administrators | Institution-wide analytics, user/department management, oversight, reporting |

Faculty and admin accounts are never self-service — they require explicit
approval by an authorised admin (see Section 9, RBAC).

## 4. User stories by role

### Student
- As a new student, I register once with my academic and personal details
  so the college has an accurate record without paper forms.
- As a student, I complete my profile in sections and can save a section
  and come back later, so an incomplete session doesn't lose my progress.
- As a student, I see my profile-completion percentage so I know what's left.
- As a student, I record my achievements (sports, certifications, events)
  so they're recognised and can be verified by faculty.
- As a student, I take assigned assessments and see my own results.
- As a student, I get a development roadmap that explains *why* each
  recommendation was made from *my* profile, so I trust it.
- As a student, I can mark roadmap milestones complete and see my progress.
- As a student, I only ever see my own data.

### Faculty
- As a faculty mentor, I see only the students assigned to me (by
  department/semester/section or explicit mentoring group).
- As a faculty member, I filter my assigned students by any combination of
  academic, demographic, interest, and assessment criteria to find students
  who need follow-up.
- As a faculty member, I open one student's full authorised profile in one
  view instead of hunting across systems.
- As a faculty member, I verify or reject a student's submitted achievements.
- As a faculty member, I create and assign assessments and events to my
  students.
- As a faculty member, I review, comment on, and approve a student's
  AI-generated roadmap before it's treated as final.
- As a faculty member, I cannot see guardian contact details unless I am
  that student's assigned mentor.

### Admin
- As an admin, I see institution-wide and per-department analytics
  (completion rates, quota mix, achievement/interest/goal distribution,
  assessment participation) without exporting to Excel.
- As an admin, I compare departments side by side.
- As an admin, I approve or reject pending faculty/admin account requests.
- As an admin, I manage departments, faculty-to-student assignments, and
  portal-wide resource/event oversight.
- As an admin, I export filtered reports (CSV/PDF) for institutional use.
- As an admin, I review the audit log for account and data-access actions.

## 5. Functional requirements by module

Each module below states its purpose, core requirements, and current
build status. Status values: **Shipped** (in the MVP, tested, working
against a real schema), **Planned** (designed, not yet built), **Not
started** (spec'd in the original brief, no design work done yet).

### 5.1 Authentication & account lifecycle — *Shipped (student), Planned (faculty/admin)*
- Registration, login, logout, forgot/reset password, email verification via
  Supabase Auth.
- Account status: `pending → active`, or `rejected`/`suspended`.
- Last-login tracking; audit log for privileged actions.
- Student self-registration is open; faculty/admin require admin approval.
- **Shipped:** student registration, login, logout, forgot/reset password,
  role/status model, last-login tracking, audit-log table.
- **Planned:** faculty/admin registration + admin approval queue, email
  verification enforcement, rate limiting on auth endpoints.

### 5.2 Student registration & mandatory profile — *Shipped*
- Multi-step registration capturing all Section-5 fields (identity, contact,
  guardian info, languages, accommodation, consent).
- Profile-completion gate: dashboard stays locked until academic
  background, interests, career goals, and technical domains are all saved.
  Students can save a section and return later.
- **Shipped:** all of the above, including validation (unique USN/email/
  phone/username, password strength, consent checkbox) and a live
  completion percentage.
- **Planned:** profile-photo upload to Supabase Storage; profile-change
  history for auditable fields.

### 5.3 Student dashboard — *Shipped (foundation), Planned (rest)*
- **Shipped:** welcome header, profile-completion bar, academic summary,
  accommodation, interests/goals/domains display.
- **Planned:** achievements, assessments, events, resources, recommendations,
  AI roadmap, notifications, deadlines — each as its own module below.

### 5.4 Achievements — *Not started*
- Students add/edit/delete achievement records (category, title, level,
  evidence upload, date).
- Faculty verify or reject; verification status and remarks visible to the
  student.

### 5.5 Faculty registration, dashboard, and student directory — *Not started*
- Faculty registration form; admin-gated approval.
- `faculty_student_assignments` table scoping faculty visibility to
  assigned department/semester/section/mentoring group.
- Dashboard: assigned-student counts, completion/quota/goal/interest/domain
  distributions, assessment and psychometric completion, students flagged
  for follow-up.
- Combinable filters (Section 11 of the original brief) with saved presets,
  pagination, and CSV/PDF export of authorised results.
- Individual student detail view with guardian-field masking for
  non-mentors.

### 5.6 Admin dashboard & department management — *Not started*
- Institution-wide and per-department analytics with bar/donut/line/stacked
  charts, each with an accessible tabular alternative.
- Department CRUD (departments already exist as a configurable DB table).
- Faculty assignment management; account approval queue.

### 5.7 Assessment engine — *Not started*
- Question bank (single/multiple-choice, true/false, short/long answer,
  Likert), assessment builder (target audience, timing, attempts,
  randomisation, pass criteria), auto-grading for objective items, faculty
  grading for subjective items.
- **Psychometric assessments:** informed consent, "indicative not clinical"
  disclosure, restricted visibility to student + mentor, no use in
  opportunity decisions — these constraints are product requirements, not
  optional copy.
- **English assessment:** section-wise scoring (grammar, vocabulary, reading,
  writing, communication readiness); no unearned CEFR-level claims.

### 5.8 Events — *Not started*
- Faculty/admin create, publish, and track events (capacity, eligibility,
  registration deadline, attendance, certificates, feedback).
- Students browse, register, cancel (if permitted), and view participation
  history.

### 5.9 VTU resources & certification recommendations — *Not started*
- Admin-managed, source-verified links to VTU scheme/syllabus documents and
  NPTEL/SWAYAM/vendor certifications — **no fabricated URLs or metadata**;
  unverified entries are visibly marked as such until an admin verifies them.
- Recommendations personalised by department, interests, goals, domains, and
  assessment performance, each showing *why* it was recommended.

### 5.10 AI-powered individual roadmap — *Not started*
- Generated from the student's profile + assessment results; explainable
  (shows which inputs drove each recommendation), editable, regenerable.
- Milestones at 30 days / 3–6 months / 1–4 years; progress tracking.
- Variants for IT employability, non-IT employability, GATE/higher studies,
  study abroad, entrepreneurship.
- Mentor review/approval workflow; versioned with model/provider and
  approval status.
- **Rule-based fallback** if the AI provider is unavailable — the roadmap
  feature must never simply fail.

### 5.11 Notifications, reports, real-time updates — *Not started*
- In-app notifications for the event types listed in the original brief
  (profile completion, assessment deadlines, results, events, achievement
  verification, roadmap updates, faculty feedback).
- CSV/PDF report generation across the report types in the original brief,
  each showing applied filters, generator, and timestamp.
- Live updates for dashboard counts, completion status, submissions, and
  registrations via Supabase real-time subscriptions (not polling).

## 6. Non-functional requirements

- **Accessibility:** visible keyboard focus (shipped, global), sufficient
  colour contrast, labelled form controls, accessible tabular alternative
  for every chart, `prefers-reduced-motion` respected (shipped).
- **Responsiveness:** usable on mobile, tablet, and desktop; sidebar nav
  collapses to a mobile header (shipped for the student area).
- **Security:** role enforcement at three layers — middleware, server
  action, and Postgres RLS (shipped for the student slice); no secrets in
  client bundles; audit logging for privileged actions.
- **Privacy:** consent recorded at registration (shipped); guardian-contact
  masking for non-mentors (planned, depends on 5.5); data export/delete
  request workflow (planned).
- **Reliability:** AI features must degrade to a rule-based fallback rather
  than fail outright (planned, see 5.10).
- **Data integrity:** unique constraints on USN/email/phone/username
  (shipped); referential integrity via foreign keys and RLS (shipped for
  MVP tables).

## 7. Success metrics

- % of first-year students with a 100%-complete mandatory profile within
  the first two weeks of term.
- Median time for a faculty mentor to locate and open a specific student's
  profile (target: under 30 seconds once 5.5 ships).
- % of generated roadmaps reviewed/approved by a mentor within 7 days.
- Achievement verification turnaround time.
- Admin-reported reduction in manual spreadsheet reporting.

## 8. Release plan

| Phase | Scope | Status |
|---|---|---|
| 1. Planning | Architecture, role matrix, DB plan, route map | **Done** |
| 2. Foundation | Auth, RBAC, schema, branding, registration, mandatory profile gate | **Done (MVP shipped)** |
| 3. Dashboards & analytics | Faculty dashboard, admin dashboard, filters, charts, student detail view | **Not started** |
| 4. Extended modules | Achievements, assessments, events, resources, recommendations, AI roadmap, notifications, reports | **Not started** |
| 5. Verification | Full test suite, security/accessibility review, production build | **Partial** — unit tests + typecheck + build pass for the MVP slice; no integration/e2e tests yet |

## 9. Open questions for stakeholders

- Exact list of faculty designations and whether "faculty" and "mentor" are
  always the same account, or whether a student can have a different
  academic advisor vs. mentor.
- Retention period for rejected/suspended accounts and for consent records.
- Whether achievement evidence uploads need virus scanning before storage.
- Final decision on which LLM provider serves the roadmap engine in
  production, and its data-handling terms for student information.
- Official HKBK logo file and brand guidelines (currently a placeholder).
