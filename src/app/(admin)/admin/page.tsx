import type { Metadata } from "next";
import { Card, CardBody, CardHeader, ProgressBar, StatTile } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DistributionChart } from "@/components/directory/DistributionChart";
import { getAdminOverview } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Institution overview" };

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();
  const { institution, departments } = overview;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brass-600">Institution-wide</p>
          <h1 className="mt-1 text-2xl text-indigo-950 sm:text-3xl">
            First-year overview
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Every first-year student on the portal, across all departments.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/admin/export" variant="secondary">
            Export CSV
          </ButtonLink>
          {overview.pendingAccounts > 0 && (
            <ButtonLink href="/admin/accounts">
              {overview.pendingAccounts} pending approval
              {overview.pendingAccounts === 1 ? "" : "s"}
            </ButtonLink>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Students"
          value={String(institution.totalStudents)}
          hint="Registered on the portal"
        />
        <StatTile
          label="Profiles complete"
          value={String(institution.complete)}
          hint={`${institution.completionRate}% of the cohort`}
        />
        <StatTile
          label="Faculty accounts"
          value={String(overview.facultyCount)}
        />
        <StatTile
          label="Awaiting approval"
          value={String(overview.pendingAccounts)}
          hint={overview.pendingAccounts > 0 ? "Needs your decision" : undefined}
        />
      </div>

      <Card as="section">
        <CardBody>
          <ProgressBar
            value={institution.completionRate}
            label="Institution-wide profile completion"
          />
          <dl className="mt-5 grid gap-4 border-t border-indigo-100 pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">
                Average 10th percentage
              </dt>
              <dd className="mt-0.5 font-display text-xl text-indigo-950">
                {institution.avgTenth !== null ? `${institution.avgTenth}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">
                Average 12th / PUC percentage
              </dt>
              <dd className="mt-0.5 font-display text-xl text-indigo-950">
                {institution.avgTwelfth !== null
                  ? `${institution.avgTwelfth}%`
                  : "—"}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* Department comparison (PRD 5.6) */}
      <Card as="section">
        <CardHeader
          title="Departments side by side"
          description="Averages skip students who haven't filled that field, rather than counting them as zero."
        />
        <CardBody className="px-0 py-0 sm:px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">
                Per-department student counts, completion, and averages
              </caption>
              <thead>
                <tr className="border-b border-indigo-100 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Department
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Students
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Complete
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Avg 10th
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Avg 12th
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Away / Home
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-100">
                {departments.map((dept) => (
                  <tr key={dept.code} className="hover:bg-indigo-50/40">
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <span className="font-medium text-indigo-950">
                        {dept.code}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {dept.name}
                      </span>
                    </th>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">
                      {dept.total}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                      {dept.complete}
                      <span className="ml-1 text-xs text-ink-faint">
                        ({dept.completionRate}%)
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                      {dept.avgTenth ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                      {dept.avgTwelfth ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-muted">
                      {dept.livingAway} / {dept.livingAtHome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Internal marks coverage (migration 0025).
          Coverage and per-component averages only — never a CIE, and never a
          single pooled "average mark", which across components with different
          maxima would be a number with no meaning. */}
      <Card as="section">
        <CardHeader
          title="Internal marks"
          description="How much marking has happened and how much of it students can see. These are averages of recorded marks against each component's own maximum — not a CIE, which the college calculates from the VTU scheme."
        />
        <CardBody className="space-y-4">
          {overview.marks.entriesRecorded === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing recorded yet. Marks are entered per subject by the
              assigned teacher under Internal marks, against the VTU scheme
              subjects on this portal.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatTile
                  label="Students with marks"
                  value={String(overview.marks.studentsWithMarks)}
                  hint={`of ${institution.totalStudents} on the portal`}
                />
                <StatTile
                  label="Marks recorded"
                  value={String(overview.marks.entriesRecorded)}
                  hint="One per student, subject, and component"
                />
                <StatTile
                  label="Released to students"
                  value={String(overview.marks.entriesReleased)}
                  hint={
                    overview.marks.entriesReleased <
                    overview.marks.entriesRecorded
                      ? `${
                          overview.marks.entriesRecorded -
                          overview.marks.entriesReleased
                        } still withheld`
                      : "All of them"
                  }
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <caption className="sr-only">
                    Per-component marks coverage and averages
                  </caption>
                  <thead>
                    <tr className="border-b border-indigo-100 text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Component
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Recorded
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Released
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Average
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50">
                    {overview.marks.byComponent.map((component) => (
                      <tr key={component.code}>
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          <span className="font-medium text-indigo-950">
                            {component.label}
                          </span>
                          <span className="ml-1 text-xs text-ink-faint">
                            out of {component.maxMarks}
                          </span>
                        </th>
                        <td className="py-2 pr-3 text-right tabular-nums text-ink">
                          {component.recorded}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">
                          {component.released}
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-muted">
                          {/* Em dash, not 0% — nothing recorded is not the
                              same as everyone scoring nothing. */}
                          {component.averagePercent === null
                            ? "—"
                            : `${component.averagePercent}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-ink-faint">
                Averages skip students who have not been marked rather than
                counting them as zero, so an unmarked cohort does not read as a
                failing one.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <DistributionChart
          title="By department"
          data={institution.byDepartment}
        />
        {overview.marks.entriesRecorded > 0 && (
          <DistributionChart
            title="Students marked, by department"
            description="Students carrying at least one recorded mark."
            data={overview.marks.markedByDepartment}
          />
        )}
        <DistributionChart title="By semester" data={institution.bySemester} />
        <DistributionChart
          title="By admission quota"
          data={institution.byQuota}
        />
        <DistributionChart
          title="By residence type"
          description="Where students live during term."
          data={institution.byResidence}
        />
        <DistributionChart
          title="By home state"
          description="Where students are joining from."
          data={institution.byState.slice(0, 12)}
        />
      </div>
    </div>
  );
}
