import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody, EmptyState } from "@/components/ui/Card";
import { RoadmapView } from "@/components/roadmap/RoadmapView";
import { RoadmapAnalysis } from "@/components/roadmap/RoadmapAnalysis";
import { getOwnStudent, getLookups, getProfileSnapshot } from "@/lib/queries/student";
import { getOwnRoadmap } from "@/lib/queries/roadmaps";
import { getDepartmentStats } from "@/lib/queries/vtu";
import { refreshOwnRoadmap } from "@/lib/roadmap/refresh";

export const metadata: Metadata = { title: "My roadmap" };

// The plan is regenerated on view when the profile has moved on, so this page
// must never be served from a cache.
export const dynamic = "force-dynamic";

export default async function StudentRoadmapPage() {
  const student = await getOwnStudent();
  if (!student) redirect("/login");

  // Regenerate first, then read. A student who has just changed their goals
  // should see the consequence on this page load, not the next one.
  const refresh = await refreshOwnRoadmap();

  const [roadmap, lookups, snapshot, departmentStats] = await Promise.all([
    getOwnRoadmap(),
    getLookups(),
    getProfileSnapshot(student),
    getDepartmentStats(student.departmentCode),
  ]);

  const nameById = (
    options: Array<{ id: number; name: string }>,
    ids: number[],
  ) => {
    const map = new Map(options.map((o) => [o.id, o.name]));
    return ids.map((id) => map.get(id)).filter(Boolean) as string[];
  };

  const chosenDomains = nameById(lookups.domains, snapshot.domainIds);

  // Phrased as the student would describe the section, not as column names.
  const profileGaps = [
    snapshot.goalIds.length === 0 ? "Career goals" : null,
    snapshot.domainIds.length === 0 ? "Technical domains" : null,
    snapshot.interestIds.length === 0 ? "Areas of interest" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">My roadmap</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Built from your career goals, technical domains, and the VTU scheme
          recorded for your department. It updates itself whenever you change
          your profile.
        </p>
      </header>

      {refresh.changed && (
        <p className="rounded-lg border border-success/25 bg-success/5 px-3.5 py-2.5 text-sm text-success">
          Your profile changed, so this plan has just been rebuilt —{" "}
          {refresh.milestones} milestones. Anything you had already ticked off
          applied to the previous version.
        </p>
      )}

      {!roadmap ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No plan yet"
              description="Add your career goals and technical domains to your profile, and a plan appears here straight away."
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <RoadmapAnalysis
            roadmap={roadmap}
            chosenDomains={chosenDomains}
            department={student.departmentCode}
            departmentStats={departmentStats}
            profileGaps={profileGaps}
          />

          <RoadmapView roadmap={roadmap} interactive />
        </>
      )}
    </div>
  );
}
