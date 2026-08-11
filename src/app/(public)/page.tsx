import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { HeroRoleSwitcher } from "@/components/ui/HeroRoleSwitcher";
import { branding } from "@/config/branding";
import { SEED_DEPARTMENTS } from "@/config/branding";

const ROLES = [
  {
    title: "Students",
    body: "Complete your profile once, record achievements, take assigned assessments, and follow a development roadmap built from your own goals.",
  },
  {
    title: "Faculty mentors",
    body: "Find any assigned student in seconds with combinable filters, verify achievements, and review roadmaps before they reach the student.",
  },
  {
    title: "Administrators",
    body: "Department-wise and institution-wide analytics, account approvals, and exportable reports — without a spreadsheet in sight.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-indigo-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Logo />
          <nav className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Register
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-indigo-100">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-brass-200/25 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex items-center rounded-full border border-brass-300/60 bg-brass-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brass-700">
                {branding.institution.shortName} · First year
              </p>
              <h1 className="text-4xl leading-[1.1] text-indigo-950 sm:text-5xl md:text-6xl">
                Every first-year student,{" "}
                <span className="text-brass-600">actually known</span> by the
                people mentoring them.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                A single record of each student&apos;s academic background,
                interests, goals, and achievements — turned into filterable
                analytics for faculty and a mentor-reviewed development roadmap
                for the student.
              </p>
              <HeroRoleSwitcher />
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="text-2xl text-indigo-950 sm:text-3xl">
            Built around three roles, with hard boundaries between them
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            A student never sees another student&apos;s data. A faculty member
            never sees students outside their assignment. Those limits are
            enforced in the database itself, not only in the interface.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ROLES.map((role) => (
              <article
                key={role.title}
                className="rounded-card border border-indigo-100 bg-white p-6 shadow-card transition-shadow hover:shadow-lift"
              >
                <h3 className="text-lg text-indigo-950">{role.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {role.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Departments */}
        <section className="border-y border-indigo-100 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-faint">
              First-year departments
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {SEED_DEPARTMENTS.map((dept) => (
                <li
                  key={dept.code}
                  className="rounded-lg border border-indigo-100 bg-parchment px-3.5 py-2 text-sm text-indigo-900"
                >
                  <span className="font-semibold">{dept.code}</span>
                  <span className="ml-2 text-ink-faint">{dept.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-4 border-t border-indigo-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-950">
              {branding.institution.name}
            </p>
            <p className="text-xs text-ink-faint">
              {branding.institution.affiliation}
            </p>
          </div>
          <div className="flex gap-5 text-sm">
            <Link
              href="/privacy"
              className="rounded text-ink-muted hover:text-indigo-900 hover:underline"
            >
              Privacy notice
            </Link>
            <a
              href={`mailto:${branding.contacts.support}`}
              className="rounded text-ink-muted hover:text-indigo-900 hover:underline"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
