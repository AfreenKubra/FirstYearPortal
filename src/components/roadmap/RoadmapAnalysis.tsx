import { Card, CardBody, CardHeader, ProgressBar, StatTile } from "@/components/ui/Card";
import { DistributionChart } from "@/components/directory/DistributionChart";
import { HORIZONS, HORIZON_LABELS } from "@/lib/roadmap/generate";
import type { Roadmap } from "@/lib/queries/roadmaps";
import type { DepartmentStats } from "@/lib/queries/vtu";

/**
 * The graphical analysis beside a student's roadmap (PRD 5.10, 5.11).
 *
 * Every chart here is single-hue and drawn inside a table, matching the rest
 * of the portal: the categories are named in the row headers, so spending the
 * palette on identity the labels already carry would only make the chart
 * harder to read for anyone who cannot separate the hues.
 *
 * Recomputed on every render from the plan on screen, so the picture cannot
 * drift from the milestones underneath it.
 */
export function RoadmapAnalysis({
  roadmap,
  chosenDomains,
  department,
  departmentStats,
  profileGaps,
}: {
  roadmap: Roadmap;
  /** Technical domains the student selected, by name. */
  chosenDomains: string[];
  department: string;
  departmentStats: DepartmentStats;
  /** Profile sections still empty, in the words the student would use. */
  profileGaps: string[];
}) {
  const total = roadmap.milestones.length;
  const done = roadmap.milestones.filter((m) => m.completedAt !== null).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  // 1. Progress by horizon
  const byHorizon = HORIZONS.map((horizon) => {
    const inHorizon = roadmap.milestones.filter((m) => m.horizon === horizon);
    return {
      label: HORIZON_LABELS[horizon],
      count: inHorizon.filter((m) => m.completedAt !== null).length,
      outOf: inHorizon.length,
    };
  }).filter((row) => row.outOf > 0);

  // 2. Domain coverage — how many milestones cite each domain the student
  // chose. Counted from the rationale, which is where the generator recorded
  // why the milestone exists, so this cannot claim a link the plan does not
  // actually make.
  const domainCoverage = chosenDomains
    .map((domain) => ({
      label: domain,
      count: roadmap.milestones.filter((m) => m.rationale.includes(domain)).length,
    }))
    .sort((a, b) => b.count - a.count);

  const uncovered = domainCoverage.filter((d) => d.count === 0);

  return (
    <section aria-labelledby="roadmap-analysis" className="space-y-5">
      <h2 id="roadmap-analysis" className="text-lg text-indigo-950">
        How your plan is going
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Milestones" value={String(total)} />
        <StatTile
          label="Completed"
          value={String(done)}
          hint={`${percent}% of your plan`}
        />
        <StatTile
          label="Domains covered"
          value={`${domainCoverage.filter((d) => d.count > 0).length} / ${chosenDomains.length || 0}`}
          hint={chosenDomains.length === 0 ? "None chosen yet" : undefined}
        />
        <StatTile
          label={`${department} average`}
          value={
            departmentStats.avgCompletion === null
              ? "—"
              : `${departmentStats.avgCompletion}%`
          }
          hint={
            departmentStats.cohortSize === null
              ? "Too few plans to compare"
              : `across ${departmentStats.cohortSize} students`
          }
        />
      </div>

      <Card as="section">
        <CardBody>
          <ProgressBar value={percent} label="Overall progress" />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionChart
          title="Progress by horizon"
          description="Milestones you have marked done, in each timeframe."
          data={byHorizon.map((r) => ({
            label: `${r.label} (${r.count}/${r.outOf})`,
            count: r.count,
          }))}
          emptyMessage="No milestones yet."
        />

        <DistributionChart
          title="Domain coverage"
          description="How many milestones relate to each domain you chose."
          data={domainCoverage}
          emptyMessage="You have not chosen any technical domains yet."
        />
      </div>

      {uncovered.length > 0 && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-warning">
          Nothing in your plan currently addresses{" "}
          {uncovered.map((d) => d.label).join(", ")}. That usually means the
          portal has no material tagged to those domains yet — worth mentioning
          to your mentor.
        </p>
      )}

      {/* 3. Profile completeness. A thin plan should visibly trace back to a
          thin profile rather than looking arbitrary. */}
      <Card as="section">
        <CardHeader
          title="What this plan was built from"
          description="Your plan is only as specific as the profile behind it."
        />
        <CardBody>
          {profileGaps.length === 0 ? (
            <p className="text-sm text-success">
              Every section the generator reads is filled in.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                These are still empty, and each one would make your plan more
                specific:
              </p>
              <ul className="mt-2 space-y-1">
                {profileGaps.map((gap) => (
                  <li key={gap} className="text-sm text-warning">
                    {gap}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      {/* 4. Department comparison. Deliberately an average against a cohort,
          never a rank against named peers — and the database returns nothing
          at all below five students, because an average over three is close
          enough to identify someone. */}
      <Card as="section">
        <CardHeader
          title={`Compared with ${department}`}
          description="Cohort averages only. Nobody can see your plan but you and your mentor."
        />
        <CardBody>
          {departmentStats.avgCompletion === null ? (
            <p className="text-sm text-ink-muted">
              Not enough students in your department have a plan yet to show a
              meaningful average — and with a handful, an average would say
              more about individuals than about the cohort.
            </p>
          ) : (
            <div className="space-y-3">
              <ProgressBar value={percent} label="You" />
              <ProgressBar
                value={departmentStats.avgCompletion}
                label={`${department} average`}
              />
              <p className="text-sm text-ink-muted">
                {percent >= departmentStats.avgCompletion
                  ? "You are at or above your cohort's average."
                  : "You are below your cohort's average — which is information, not a verdict. Plans differ in length, and a longer plan takes longer."}
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
