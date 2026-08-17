import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ProgressBar,
  StatTile,
} from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DistributionChart } from "./DistributionChart";
import type { FacultyStats } from "@/lib/queries/faculty";

/**
 * Dashboard for a member of teaching staff — a faculty mentor over their
 * assigned students, or a head of department over their department.
 *
 * The two differ only in whose students they are and what to say when there
 * are none; the counts, distributions, and follow-up list are the same
 * questions asked of a different set of rows.
 */
export function StaffDashboard({
  eyebrow,
  heading,
  subheading,
  basePath,
  emptyTitle,
  emptyDescription,
  stats,
}: {
  eyebrow: string;
  heading: string;
  subheading: string;
  /** Base path of this role's student directory. */
  basePath: string;
  emptyTitle: string;
  emptyDescription: string;
  stats: FacultyStats;
}) {
  const completionRate =
    stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brass-600">{eyebrow}</p>
          <h1 className="mt-1 text-2xl text-indigo-950 sm:text-3xl">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{subheading}</p>
        </div>
        <ButtonLink href={basePath} variant="secondary">
          Open student directory
        </ButtonLink>
      </header>

      {stats.total === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title={emptyTitle} description={emptyDescription} />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Students" value={String(stats.total)} />
            <StatTile
              label="Profiles complete"
              value={String(stats.complete)}
              hint={`${completionRate}% of this cohort`}
            />
            <StatTile
              label="Still incomplete"
              value={String(stats.incomplete)}
              hint="Needs follow-up"
            />
            <StatTile
              label="Departments"
              value={String(stats.byDepartment.length)}
            />
          </div>

          <Card as="section">
            <CardBody>
              <ProgressBar
                value={completionRate}
                label="Cohort profile completion"
              />
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <DistributionChart
              title="By department"
              description="Where these students sit."
              data={stats.byDepartment}
            />
            <DistributionChart title="By semester" data={stats.bySemester} />
            <DistributionChart title="By admission quota" data={stats.byQuota} />
            <DistributionChart
              title="By residence type"
              description="Where these students live during term."
              data={stats.byResidence}
            />
          </div>

          <Card as="section">
            <CardHeader
              title="Flagged for follow-up"
              description="Students whose mandatory profile is still incomplete, least complete first."
              action={
                <ButtonLink
                  href={`${basePath}?completion=incomplete`}
                  variant="secondary"
                  size="sm"
                >
                  See all
                </ButtonLink>
              }
            />
            <CardBody>
              {stats.needsFollowUp.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Every student here has completed their profile.
                </p>
              ) : (
                <ul className="divide-y divide-indigo-100">
                  {stats.needsFollowUp.map((student) => (
                    <li
                      key={student.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`${basePath}/${student.id}`}
                          className="rounded font-medium text-indigo-900 hover:underline"
                        >
                          {student.fullName}
                        </Link>
                        <p className="text-xs text-ink-faint">
                          {student.usn} · {student.departmentCode}
                          {student.section ? ` · Sec ${student.section}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md border border-warning/30 bg-warning/5 px-2 py-1 text-xs font-medium tabular-nums text-warning">
                        {student.completionPercent}% complete
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
