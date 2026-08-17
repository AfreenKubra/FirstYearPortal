import { Card, CardBody, CardHeader, ProgressBar, StatTile } from "@/components/ui/Card";
import { DistributionChart } from "./DistributionChart";
import { summariseInstitution } from "@/lib/admin/analytics";
import type { DirectoryRow } from "@/lib/queries/directory";

/**
 * The graphical summary of a filtered result set (PRD 5.5, 5.6).
 *
 * Reads the *whole* filtered set, not the page on screen. A chart drawn from
 * 25 visible rows while the table header says "1–25 of 300" is a chart that
 * quietly answers a different question than the one asked, and the reader has
 * no way to tell. The same rows feed the CSV export, so the picture, the
 * table, and the downloaded file always agree.
 *
 * Aggregation goes through the pure, unit-tested helpers in
 * `lib/admin/analytics.ts` rather than being recomputed here — a completion
 * rate that disagrees with the admin dashboard's would be reported to a
 * principal as fact.
 */
export function DirectoryCharts({ rows }: { rows: DirectoryRow[] }) {
  const stats = summariseInstitution(rows, (row) => row.state);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="directory-charts-heading" className="space-y-5">
      <h2
        id="directory-charts-heading"
        className="text-lg text-indigo-950"
      >
        Overview of these {stats.totalStudents}{" "}
        {stats.totalStudents === 1 ? "student" : "students"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Students" value={String(stats.totalStudents)} />
        <StatTile
          label="Profiles complete"
          value={String(stats.complete)}
          hint={`${stats.incomplete} still incomplete`}
        />
        <StatTile
          label="Average 10th"
          value={stats.avgTenth === null ? "—" : `${stats.avgTenth}%`}
        />
        <StatTile
          label="Average 12th"
          value={stats.avgTwelfth === null ? "—" : `${stats.avgTwelfth}%`}
        />
      </div>

      <Card as="section">
        <CardHeader
          title="Profile completion"
          description="Share of these students whose mandatory profile is fully saved."
        />
        <CardBody>
          <ProgressBar
            value={stats.completionRate}
            label="Complete profiles"
            milestones={[
              {
                label: `${stats.complete} complete`,
                complete: stats.complete > 0,
              },
              {
                label: `${stats.incomplete} still to finish`,
                complete: stats.incomplete === 0,
              },
            ]}
          />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionChart
          title="By department"
          description="Where these students are enrolled."
          data={stats.byDepartment}
        />
        <DistributionChart
          title="By semester"
          description="First-year students sit in semester 1 or 2."
          data={stats.bySemester}
        />
        <DistributionChart
          title="By admission quota"
          description="How these students entered the college."
          data={stats.byQuota}
        />
        <DistributionChart
          title="By residence type"
          description="Where they live during term."
          data={stats.byResidence}
        />
      </div>

      {stats.byState.length > 1 && (
        <DistributionChart
          title="By home state"
          description="Useful for planning hostel and travel support."
          data={stats.byState.slice(0, 10)}
        />
      )}
    </section>
  );
}
