import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ProgressBar,
  StatTile,
} from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DistributionBars } from "@/components/faculty/DistributionBars";
import { getFacultyStats, getOwnFaculty } from "@/lib/queries/faculty";

export const metadata: Metadata = { title: "Faculty dashboard" };

export default async function FacultyDashboardPage() {
  const faculty = await getOwnFaculty();
  if (!faculty) redirect("/login");

  const stats = await getFacultyStats();
  const completionRate =
    stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0;

  const firstName = faculty.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brass-600">
            {faculty.designation}
          </p>
          <h1 className="mt-1 text-2xl text-indigo-950 sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {stats.total} student{stats.total === 1 ? "" : "s"} assigned to you
          </p>
        </div>
        <ButtonLink href="/faculty/students" variant="secondary">
          Open student directory
        </ButtonLink>
      </header>

      {stats.total === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No students assigned yet"
              description="Your visibility comes from assignments created by a portal administrator. Once you're assigned a department, semester, section, or mentoring group, those students appear here."
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Assigned students" value={String(stats.total)} />
            <StatTile
              label="Profiles complete"
              value={String(stats.complete)}
              hint={`${completionRate}% of your cohort`}
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
            <DistributionBars
              title="By department"
              description="Where your assigned students sit."
              data={stats.byDepartment}
            />
            <DistributionBars
              title="By semester"
              data={stats.bySemester}
            />
            <DistributionBars
              title="By admission quota"
              data={stats.byQuota}
            />
            <DistributionBars
              title="By residence type"
              description="Where your students live during term."
              data={stats.byResidence}
            />
          </div>

          <Card as="section">
            <CardHeader
              title="Flagged for follow-up"
              description="Students whose mandatory profile is still incomplete, least complete first."
              action={
                <ButtonLink
                  href="/faculty/students?completion=incomplete"
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
                  Every assigned student has completed their profile.
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
                          href={`/faculty/students/${student.id}`}
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
