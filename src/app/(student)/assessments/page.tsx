import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, EmptyState, StatTile } from "@/components/ui/Card";
import { StartAttemptButton } from "@/components/assessments/StartAttemptButton";
import { AddExternalScorePanel } from "@/components/assessments/ExternalScoreForm";
import { ExternalScoreCard } from "@/components/assessments/ExternalScoreCard";
import { getOwnStudent } from "@/lib/queries/student";
import { getStudentAssessments } from "@/lib/queries/assessments";
import {
  getOwnAssessmentAverage,
  listOwnExternalScores,
} from "@/lib/queries/external-scores";
import {
  assessmentKindLabel,
  attemptStatusLabel,
  EXTERNAL_PLATFORMS,
  SKILL_CATEGORIES,
} from "@/config/assessments";
import { AVAILABILITY_COPY } from "@/lib/assessments/grading";

export const metadata: Metadata = { title: "My assessments" };

function testLink(categoryId: string): { href: string; external: boolean } {
  if (categoryId === "personality") {
    return { href: "/assessments?kind=psychometric", external: false };
  }
  if (categoryId === "technical") {
    return { href: EXTERNAL_PLATFORMS[0].url, external: true };
  }
  return { href: EXTERNAL_PLATFORMS[1].url, external: true };
}

export default async function StudentAssessmentsPage() {
  const student = await getOwnStudent();
  if (!student) redirect("/login");

  // Independent reads, so a missing marks migration cannot delay the
  // assessment list it has nothing to do with.
  const [
    items,
    psychometricAverage,
    externalScores,
  ] = await Promise.all([
    getStudentAssessments(),
    getOwnAssessmentAverage("psychometric"),
    listOwnExternalScores(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">My assessments</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Assessments set for your department, semester, and section. Your
          results appear here once they have been marked.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Psychometric average"
          value={
            psychometricAverage.averagePercentage !== null
              ? `${psychometricAverage.averagePercentage}%`
              : "—"
          }
          hint={
            psychometricAverage.attemptCount > 0
              ? `From ${psychometricAverage.attemptCount} marked attempt${psychometricAverage.attemptCount === 1 ? "" : "s"}`
              : "No marked attempts yet"
          }
        />
        <StatTile
          label="Self-reported scores"
          value={String(externalScores.length)}
          hint="From NPTEL, Springboard, and similar"
        />
      </div>

      <Card as="section">
        <CardHeader
          title="Skills covered"
          description="What each area tests, and where to take a test. Personality links to this portal's own psychometric assessment; the rest are external platforms this portal cannot verify."
        />
        <CardBody>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              The six skill areas, what each covers, and where to test them
            </caption>
            <thead>
              <tr className="border-b border-indigo-100 text-xs uppercase tracking-wide text-ink-faint">
                <th scope="col" className="py-2 pr-3 font-medium">Area</th>
                <th scope="col" className="py-2 pr-3 font-medium">What can be tested</th>
                <th scope="col" className="py-2 pl-3 font-medium">Take the test</th>
              </tr>
            </thead>
            <tbody>
              {SKILL_CATEGORIES.map((category) => {
                const link = testLink(category.id);
                return (
                  <tr key={category.id} className="border-b border-indigo-50 align-top">
                    <th scope="row" className="py-2.5 pr-3 font-medium text-indigo-950">
                      {category.label}
                    </th>
                    <td className="py-2.5 pr-3 text-ink-muted">{category.covers}</td>
                    <td className="py-2.5 pl-3">
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          Take the test ↗
                        </a>
                      ) : (
                        <Link href={link.href} className="font-medium text-indigo-700 hover:underline">
                          Take the test
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            NPTEL and Infosys Springboard are shown as their own homepages —
            this portal does not pick a specific course or test on your behalf.
          </p>
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Your self-reported scores"
          description="Anything you've recorded from an external platform. Not verified by anyone here."
        />
        <CardBody className="space-y-4">
          {externalScores.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              description="Add a score from NPTEL, Infosys Springboard, or elsewhere."
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

      {items.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing set yet"
              description="When a faculty member publishes an assessment for your class, it appears here."
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map(({ assessment, attempts, availability }) => {
            const latest = attempts[0];

            return (
              <li key={assessment.id}>
                <Card as="section">
                  <CardHeader
                    title={assessment.title}
                    description={assessment.description ?? undefined}
                    eyebrow={assessmentKindLabel(assessment.kind)}
                  />
                  <CardBody className="space-y-3">
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-faint">
                      {assessment.durationMinutes && (
                        <div>
                          <dt className="inline">Time: </dt>
                          <dd className="inline text-ink-muted">
                            {assessment.durationMinutes} minutes
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline">Attempts: </dt>
                        <dd className="inline text-ink-muted">
                          {attempts.length} of {assessment.maxAttempts} used
                        </dd>
                      </div>
                      {assessment.closesAt && (
                        <div>
                          <dt className="inline">Closes: </dt>
                          <dd className="inline text-ink-muted">
                            {new Date(assessment.closesAt).toLocaleString()}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {latest && (
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm">
                        <p className="text-ink-muted">
                          Last attempt: {attemptStatusLabel(latest.status)}
                          {latest.percentage !== null && (
                            <>
                              {" · "}
                              <span className="font-medium tabular-nums text-indigo-900">
                                {latest.percentage}%
                              </span>
                              {latest.passed !== null &&
                                (latest.passed ? " · passed" : " · not passed")}
                            </>
                          )}
                        </p>
                        <Link
                          href={`/assessments/${assessment.id}/attempt/${latest.id}`}
                          className="rounded text-xs font-medium text-indigo-700 hover:underline"
                        >
                          {latest.status === "in_progress"
                            ? "Continue this attempt"
                            : "See your answers"}
                        </Link>
                      </div>
                    )}

                    {availability.open ? (
                      <StartAttemptButton
                        assessmentId={assessment.id}
                        kind={assessment.kind}
                        resuming={latest?.status === "in_progress"}
                      />
                    ) : (
                      <p className="text-sm text-ink-faint">
                        {AVAILABILITY_COPY[availability.reason]}
                      </p>
                    )}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
