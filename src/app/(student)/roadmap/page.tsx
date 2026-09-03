import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody, EmptyState } from "@/components/ui/Card";
import { RoadmapView } from "@/components/roadmap/RoadmapView";
import { RoadmapAnalysis } from "@/components/roadmap/RoadmapAnalysis";
import { ExamTrackPanel } from "@/components/roadmap/ExamTrackPanel";
import {
  DomainCourseShelf,
  type DomainShelf,
} from "@/components/roadmap/DomainCourseShelf";
import { getOwnStudent, getLookups, getProfileSnapshot } from "@/lib/queries/student";
import { getOwnRoadmap, roadmapProgress } from "@/lib/queries/roadmaps";
import { getDepartmentStats } from "@/lib/queries/vtu";
import { refreshOwnRoadmap } from "@/lib/roadmap/refresh";
import {
  filterExamResourcesForGoals,
  filterResourcesForDomains,
  listResources,
} from "@/lib/queries/resources";
import { countUpcomingEventsByTag } from "@/lib/queries/events";
import { getOwnAssessmentAverage } from "@/lib/queries/external-scores";
import { buildRadarData } from "@/lib/roadmap/radar";
import { RadarChart } from "@/components/roadmap/RadarChart";
import { getDomainSelections, getGoalSelections, getPathwayEvidence } from "@/lib/queries/pathway";
import { buildPathway, resolvePrimary } from "@/lib/roadmap/pathway";
import { CareerPathwayTimeline } from "@/components/roadmap/CareerPathwayTimeline";

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
  const chosenGoals = nameById(lookups.goals, snapshot.goalIds);

  /**
   * The catalogue and the college calendar, read once and sliced two ways.
   *
   * `listResources()` already fetches every tag map, so both panels come out
   * of one round trip rather than three — and, more importantly, out of the
   * *same* snapshot, so the exam track and the course shelf cannot disagree
   * about what is in the catalogue.
   *
   * Both counts below deliberately come from tagged rows only. Falling back to
   * "all upcoming workshops" would make the number drift upward every time an
   * unrelated event was published, and "3 workshops for your goal" would stop
   * being true the moment it was most useful.
   */
  const [catalogue, workshopsOnCalendar, assessmentAverage, goalSelections, domainSelections, pathwayEvidence] =
    await Promise.all([
      listResources(),
      countUpcomingEventsByTag({
        goalIds: snapshot.goalIds,
        domainIds: snapshot.domainIds,
        kind: "workshop",
      }),
      getOwnAssessmentAverage(),
      getGoalSelections(student.id),
      getDomainSelections(student.id),
      getPathwayEvidence(student.id),
    ]);

  // The career pathway timeline: independent of the AI/rule-based roadmap
  // below it, so it renders whenever the student has at least one goal and
  // one domain selected, even before that roadmap has ever been generated.
  const primaryGoal = resolvePrimary(goalSelections);
  const primaryDomain = resolvePrimary(domainSelections);
  const recordedSemester = snapshot.academic.semester ?? null;
  const pathway =
    primaryGoal && primaryDomain
      ? buildPathway({
          goalName: primaryGoal.name,
          domainName: primaryDomain.name,
          // Where the student is comes from the academic record, not from
          // anything they ticked off about themselves.
          semester: recordedSemester,
        })
      : null;
  const secondaryDomainNames = domainSelections
    .filter((d) => d.id !== primaryDomain?.id)
    .map((d) => d.name);

  // Five real ratios, not an invented "how you're doing" score — see
  // `radar.ts`. `roadmap` may be null above this point in a first render, so
  // milestone progress is 0 rather than skipping the axis.
  const radarData = buildRadarData({
    goalsChosen: snapshot.goalIds.length,
    goalsOffered: lookups.goals.length,
    domainsChosen: snapshot.domainIds.length,
    domainsOffered: lookups.domains.length,
    interestsChosen: snapshot.interestIds.length,
    interestsOffered: lookups.interests.length,
    milestonesPercent: roadmap ? roadmapProgress(roadmap).percent : 0,
    assessmentAveragePercent: assessmentAverage.averagePercentage,
  });

  const exams = filterExamResourcesForGoals(catalogue, snapshot.goalIds);

  const workshopsInCatalogue = filterResourcesForDomains(
    catalogue,
    snapshot.domainIds,
    ["workshop"],
  ).length;

  // One shelf per domain the student picked, in the order the lookup returns
  // them. Domains with nothing tagged are kept as empty shelves so the panel
  // can name the gap rather than quietly omitting the domain.
  const shelves: DomainShelf[] = snapshot.domainIds
    .map((id) => {
      const domain = lookups.domains.find((d) => d.id === id);
      if (!domain) return null;
      return {
        domain: domain.name,
        resources: filterResourcesForDomains(catalogue, [id]),
      };
    })
    .filter((s): s is DomainShelf => s !== null);

  // Real counts for the pathway's "Recommended for your journey" cards —
  // the same catalogue `DomainCourseShelf` reads below, just counted by kind
  // for the primary domain rather than listed in full a second time.
  const primaryDomainResources = primaryDomain
    ? filterResourcesForDomains(catalogue, [primaryDomain.id])
    : [];
  const courseCount = primaryDomainResources.filter((r) => r.kind === "course").length;
  const certificationCount = primaryDomainResources.filter(
    (r) => r.kind === "certification",
  ).length;

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

      {pathway && (
        <CareerPathwayTimeline
          goalOptions={goalSelections}
          domainOptions={domainSelections}
          allGoals={lookups.goals}
          allDomains={lookups.domains}
          primaryGoal={primaryGoal}
          primaryDomain={primaryDomain}
          secondaryDomainNames={secondaryDomainNames}
          pathway={pathway}
          evidence={pathwayEvidence}
          semester={recordedSemester}
          courseCount={courseCount}
          certificationCount={certificationCount}
          workshopCount={workshopsOnCalendar}
        />
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
          <RadarChart data={radarData} />

          {/* Above the milestones: a date you can miss outranks a plan you can
              do at any time. Renders nothing at all when no dated exam is
              tagged to the student's goals. */}
          <ExamTrackPanel
            exams={exams}
            goalNames={chosenGoals}
            workshopsOnCalendar={workshopsOnCalendar}
            workshopsInCatalogue={workshopsInCatalogue}
          />

          <RoadmapAnalysis
            roadmap={roadmap}
            chosenDomains={chosenDomains}
            department={student.departmentCode}
            departmentStats={departmentStats}
            profileGaps={profileGaps}
          />

          <RoadmapView roadmap={roadmap} interactive />

          {/* Below: reference material, browsed rather than scheduled. */}
          <DomainCourseShelf shelves={shelves} chosenDomains={chosenDomains} />
        </>
      )}
    </div>
  );
}
