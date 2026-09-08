import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, EmptyState, StatTile } from "@/components/ui/Card";
import { StartAttemptButton } from "@/components/assessments/StartAttemptButton";
import { AddExternalScorePanel } from "@/components/assessments/ExternalScoreForm";
import { ExternalScoreCard } from "@/components/assessments/ExternalScoreCard";
import { ReadinessGauge } from "@/components/assessments/ReadinessGauge";
import { SkillRadar } from "@/components/assessments/SkillRadar";
import { SkillAreaCard } from "@/components/assessments/SkillAreaCard";
import { getOwnStudent } from "@/lib/queries/student";
import { getOwnCategoryResults } from "@/lib/queries/assessments";
import { listOwnExternalScores } from "@/lib/queries/external-scores";
import {
  assessmentKindLabel,
  attemptStatusLabel,
  EXTERNAL_PRACTICE,
} from "@/config/assessments";
import { AVAILABILITY_COPY } from "@/lib/assessments/grading";
import {
  buildInsights,
  buildReadiness,
  buildSkillAxes,
  summariseExternal,
  type ExternalResult,
} from "@/lib/assessments/readiness";

export const metadata: Metadata = { title: "My assessments" };

/**
 * The student's assessment dashboard.
 *
 * Every figure on this page is derived from marked attempt rows by the pure
 * functions in `lib/assessments/readiness.ts` — there is no sample data, no
 * placeholder score, and no default of zero. A student who has sat nothing
 * sees "Not attempted yet" throughout, and that is the correct rendering of
 * their situation rather than a gap to be filled.
 *
 * Papers are grouped into the six skill areas by `assessments.skill_category`
 * (0039). A paper without one still appears, further down, under its own
 * heading — it is a real assessment, it just is not one of the six areas the
 * readiness figure claims to measure.
 */
export default async function StudentAssessmentsPage() {
  const student = await getOwnStudent();
  if (!student) redirect("/login");

  const [{ byCategory, uncategorised }, externalScores] = await Promise.all([
    getOwnCategoryResults(),
    listOwnExternalScores(),
  ]);

  const readiness = buildReadiness(
    byCategory.map((c) => ({ categoryId: c.categoryId, attempts: [...c.attempts] })),
  );
  const axes = buildSkillAxes(readiness.summaries);
  const insights = buildInsights(readiness);
  const resultsByCategory = new Map(byCategory.map((c) => [c.categoryId, c]));

  // External results, mapped once into the shape the pure summariser takes.
  // They are deliberately kept out of `buildReadiness`: the gauge above is
  // about work this portal marked, and folding a self-reported number into it
  // would make that figure mean something the heading does not say.
  const externalResults: ExternalResult[] = externalScores.map((score) => ({
    id: score.id,
    categoryId: score.category,
    platform: score.platform,
    testName: score.testName,
    scoreLabel: score.scoreLabel,
    scoreValue: score.scoreValue,
    maxScore: score.maxScore,
    takenOn: score.takenOn,
    verification: score.verification,
    reviewerNote: score.reviewerNote,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">My assessments</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Six skill areas, and how you are doing in each. Everything here comes
          from assessments you have actually sat and that have been marked.
        </p>
      </header>

      {/* --- Overall readiness ------------------------------------------- */}
      <Card as="section">
        <CardHeader
          title="Overall assessment readiness"
          description="The average of your latest marked score in each scored area you have attempted. The personality questionnaire is not scored, so it is not counted here."
        />
        <CardBody>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <ReadinessGauge
              percentage={readiness.overallPercentage}
              level={readiness.overallLevel}
            />

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <StatTile
                label="Areas attempted"
                value={`${readiness.completedCount}/${readiness.totalCategories}`}
                hint="Of the six skill areas"
              />
              <StatTile
                label="Total attempts"
                value={String(readiness.totalAttempts)}
                hint="Across every area"
              />
              <StatTile
                label="Strongest area"
                value={readiness.strongest?.label ?? "—"}
                hint={
                  readiness.strongest?.latestPercentage != null
                    ? `${readiness.strongest.latestPercentage}%`
                    : "Needs results in two areas to compare"
                }
              />
              <StatTile
                label="Needs improvement"
                value={readiness.needsImprovement?.label ?? "—"}
                hint={
                  readiness.needsImprovement?.latestPercentage != null
                    ? `${readiness.needsImprovement.latestPercentage}%`
                    : "Needs results in two areas to compare"
                }
              />
            </div>
          </div>

          {insights.length > 0 && (
            <dl className="mt-5 space-y-1.5 border-t border-indigo-100 pt-4">
              {insights.map((insight) => (
                <div key={insight.heading} className="text-sm">
                  <dt className="inline font-medium text-indigo-950">
                    {insight.heading}:{" "}
                  </dt>
                  <dd className="inline text-ink-muted">{insight.detail}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardBody>
      </Card>

      {/* --- Per-area cards ---------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-lg text-indigo-950">Assessment progress</h2>
        <div className="grid gap-4">
          {readiness.summaries.map((summary) => (
            <SkillAreaCard
              key={summary.categoryId}
              summary={summary}
              results={resultsByCategory.get(summary.categoryId)}
              external={summariseExternal(externalResults, summary.categoryId)}
            />
          ))}
        </div>
      </section>

      {/* --- Radar -------------------------------------------------------- */}
      <SkillRadar axes={axes} />

      {/* --- Other papers ------------------------------------------------- */}
      {uncategorised.length > 0 && (
        <Card as="section">
          <CardHeader
            title="Other assessments set for your class"
            description="Papers that are not one of the six skill areas — a subject test or a departmental exercise. They are not counted in the readiness figure above."
          />
          <CardBody>
            <ul className="space-y-3">
              {uncategorised.map(({ assessment, attempts, availability }) => {
                const latest = attempts[0];
                return (
                  <li
                    key={assessment.id}
                    className="rounded-lg border border-indigo-100 px-3.5 py-3"
                  >
                    <p className="text-sm font-medium text-indigo-950">
                      {assessment.title}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {assessmentKindLabel(assessment.kind)}
                      {assessment.durationMinutes
                        ? ` · ${assessment.durationMinutes} minutes`
                        : ""}
                      {` · ${attempts.length} of ${assessment.maxAttempts} attempts used`}
                    </p>

                    {latest && (
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Last attempt: {attemptStatusLabel(latest.status)}
                        {latest.percentage !== null && (
                          <>
                            {" · "}
                            <span className="font-medium tabular-nums text-indigo-900">
                              {latest.percentage}%
                            </span>
                          </>
                        )}
                        {" · "}
                        <Link
                          href={`/assessments/${assessment.id}/attempt/${latest.id}`}
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          {latest.status === "in_progress"
                            ? "Continue this attempt"
                            : "See your answers"}
                        </Link>
                      </p>
                    )}

                    <div className="mt-2">
                      {availability.open ? (
                        <StartAttemptButton
                          assessmentId={assessment.id}
                          kind={assessment.kind}
                          resuming={latest?.status === "in_progress"}
                        />
                      ) : (
                        <p className="text-xs text-ink-faint">
                          {AVAILABILITY_COPY[availability.reason]}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* --- Self-reported external results ------------------------------- */}
      <Card as="section">
        <CardHeader
          title="Your external results"
          description="Anything you have recorded from an outside platform. Self-reported until a faculty member verifies it, and never counted in the readiness figure above."
        />
        <CardBody className="space-y-4">
          {externalScores.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              description="Sat a test somewhere else? Record it here so it appears on your profile."
            />
          ) : (
            <ul className="space-y-3">
              {externalScores.map((score) => (
                <ExternalScoreCard key={score.id} score={score} />
              ))}
            </ul>
          )}
          <AddExternalScorePanel />
        </CardBody>
      </Card>

      {/* --- External practice -------------------------------------------- */}
      <Card as="section">
        <CardHeader
          title="External practice resources"
          description="Optional practice on outside platforms. None of these send results back here — if you want a score on your profile, record it above."
        />
        <CardBody>
          <ul className="space-y-2">
            {EXTERNAL_PRACTICE.map((practice) => (
              <li key={practice.url} className="flex flex-wrap items-baseline gap-x-2">
                <a
                  href={practice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  {practice.label} ↗
                </a>
                <span className="text-xs text-ink-faint">{practice.provider}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
