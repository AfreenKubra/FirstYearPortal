import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { SUM_DISCLAIMER } from "@/config/marks";

/**
 * Where a member of teaching staff finds their reports (PRD 5.11).
 *
 * Mirrors the administrator's reports page, and for the same reason: a report
 * is something people come looking for rather than stumble across, and every
 * file here carries student personal data — worth saying once, plainly, at
 * the point somebody is about to download one.
 *
 * Faculty and heads of department share this; only the paths and the scope
 * sentence differ, as everywhere else in the staff area.
 */
export function StaffReports({
  basePath,
  scopeNote,
  guardianNote,
}: {
  /** `/faculty` or `/hod`. */
  basePath: string;
  /** One line stating whose students these cover. */
  scopeNote: string;
  /** What this role gets in the guardian columns. */
  guardianNote: string;
}) {
  const reports = [
    {
      title: "Internal marks",
      description:
        "One row per student per subject, with a column for each component — 1st IA, 2nd IA, assignment, activity — plus the total recorded.",
      href: `${basePath}/marks/export`,
      note: "Includes components you have not released yet; they are named in an 'Unreleased components' column so nothing here is mistaken for something the student has seen.",
    },
    {
      title: "Student details",
      description: `Academic background, contact details, residence, and profile completion, one row per student. ${guardianNote}`,
      href: `${basePath}/students/export`,
      note: "Carries three marks summary columns as well, so you can tell who has been marked without opening the marks report.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {scopeNote} Every export carries a header naming who generated it,
          when, and which filters produced it — so a file that has been emailed
          around can still be traced back to the query behind it.
        </p>
      </header>

      <p className="rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-warning">
        These files contain personal data about real students. They are served
        with no-store headers so nothing caches them, but once a file is on
        your machine it is your responsibility — do not email it onward without
        a reason to.
      </p>

      <ul className="space-y-3">
        {reports.map((report) => (
          <li key={report.href}>
            <Card as="section">
              <CardHeader
                title={report.title}
                description={report.description}
              />
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-xs text-ink-faint">{report.note}</p>
                <ButtonLink href={report.href} variant="secondary">
                  Download CSV
                </ButtonLink>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Card as="section">
        <CardHeader title="Two things worth knowing" />
        <CardBody>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li>
              <span className="font-medium text-ink">
                Both exports follow your filters.
              </span>{" "}
              Narrow the{" "}
              <a
                href={`${basePath}/students`}
                className="rounded font-medium text-indigo-700 hover:underline"
              >
                student directory
              </a>{" "}
              first and the files describe that same cohort — filter state
              lives in the URL, so a filtered view can be bookmarked or shared.
            </li>
            <li>
              <span className="font-medium text-ink">
                The marks total is not CIE.
              </span>{" "}
              {SUM_DISCLAIMER}
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
