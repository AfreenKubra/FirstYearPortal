import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { branding } from "@/config/branding";

export const metadata: Metadata = { title: "Privacy notice" };

const SECTIONS = [
  {
    heading: "What we collect",
    body: "Your identity and contact details, USN and department, academic background (10th and 12th percentages, quota, entrance rank, semester and section), languages, residence type (whether you live in a hostel, PG, rented flat, or at home), your stated interests, career goals and technical domains, achievements you submit, and results of assessments assigned to you.",
  },
  {
    heading: "Guardian details",
    body: "We record your parent or guardian's name and mobile number. These are visible to you, to your assigned faculty mentor, and to portal administrators. Faculty who are not your assigned mentor cannot see them.",
  },
  {
    heading: "Why we collect it",
    body: "To build your development roadmap, to let your mentor support you without asking you to repeat information, and to let the institution report on first-year outcomes in aggregate.",
  },
  {
    heading: "Who can see your record",
    body: "You can always see your own record in full. Your assigned faculty mentor sees your authorised profile. Administrators see institution-wide data. No student can see another student's record — this is enforced by the database, not only by the interface.",
  },
  {
    heading: "Psychometric assessments",
    body: "Where the portal offers psychometric assessments, they are for self-development and mentoring only. They are indicative, not clinical, and are never used as a basis to deny you any opportunity. Results are visible only to you and your assigned mentor.",
  },
  {
    heading: "Your development roadmap",
    body: "Roadmaps are generated from your profile and assessment results and are always reviewed by a human mentor before being treated as final. Each recommendation shows which parts of your profile produced it.",
  },
  {
    heading: "Your choices",
    body: "You give consent at registration and that consent record is kept. You can ask for a copy of your data or ask for corrections by contacting the portal administrator.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-indigo-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="rounded-lg">
            <Logo />
          </Link>
          <Link
            href="/register"
            className="rounded text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Back to registration
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl text-indigo-950 sm:text-4xl">Privacy notice</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          How {branding.institution.name} handles the information you enter into
          the {branding.product.name}.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg text-indigo-950">{section.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-card border border-indigo-100 bg-white p-6 shadow-card">
          <h2 className="text-base text-indigo-950">Questions about your data</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Contact the portal administrator at{" "}
            <a
              href={`mailto:${branding.contacts.privacy}`}
              className="rounded font-medium text-indigo-700 underline hover:text-indigo-900"
            >
              {branding.contacts.privacy}
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
