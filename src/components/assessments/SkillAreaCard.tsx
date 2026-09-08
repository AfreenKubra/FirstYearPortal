import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { ReadinessGauge } from "./ReadinessGauge";
import { ProgressLineChart } from "./ProgressLineChart";
import { StartAttemptButton } from "./StartAttemptButton";
import { AVAILABILITY_COPY } from "@/lib/assessments/grading";
import { UNSCORED_CATEGORY_ID } from "@/config/assessments";
import {
  buildTrend,
  improvementLabel,
  type CategorySummary,
} from "@/lib/assessments/readiness";
import type { CategoryResults } from "@/lib/queries/assessments";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

/**
 * One skill area: its standing, its papers, and its history.
 *
 * Every figure on it — status, attempts, best, last — is read from this
 * student's own marked attempt rows. Nothing on this card is typed in by
 * anyone: the student sits the paper, the engine marks it on submission, and
 * the card is rebuilt from the result. There is deliberately no way to enter
 * a score here, because a number a student typed and a number this portal
 * marked would sit in the same place and look like the same fact.
 *
 * "View analysis" and "attempt history" are `<details>` panels rather than
 * separate routes. The data is already on this page, so a round trip to
 * render it somewhere else would only add a URL to maintain — and this way
 * both work with JavaScript disabled, which a results page a student is
 * relying on ought to.
 *
 * The personality area renders no percentage anywhere: no gauge figure, no
 * best score, no band. It reports that the questionnaire is complete and
 * stops there, because a personality profile has no right answers to have
 * got right.
 */
export function SkillAreaCard({
  summary,
  results,
}: {
  summary: CategorySummary;
  results: CategoryResults | undefined;
}) {
  const papers = results?.papers ?? [];
  const attempts = results?.attempts ?? [];
  const trend = buildTrend(attempts);
  const improvement = improvementLabel(trend);
  const unscored = summary.categoryId === UNSCORED_CATEGORY_ID;

  // The first paper in this area that is actually open to sit. Papers exist
  // per area, so "Take assessment" has to point at one of them rather than
  // at the area itself.
  const openPaper = papers.find((p) => p.availability.open);
  const blocked = papers.find((p) => !p.availability.open);
  const inProgress = papers.find((p) =>
    p.attempts.some((a) => a.status === "in_progress"),
  );

  return (
    <Card as="section">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start gap-5">
          <ReadinessGauge
            size={110}
            percentage={unscored ? null : summary.latestPercentage}
            level={summary.level}
          />

          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <h3 className="text-base font-medium text-indigo-950">
              {summary.label}
            </h3>
            <p className="text-xs leading-relaxed text-ink-faint">
              {summary.covers}
            </p>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 text-xs">
              {unscored ? (
                <div className="col-span-2">
                  <dt className="inline text-ink-faint">Status: </dt>
                  <dd className="inline font-medium text-ink-muted">
                    {summary.attemptCount > 0
                      ? "Personality profile completed"
                      : "Not completed yet"}
                  </dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt className="inline text-ink-faint">Status: </dt>
                    <dd className="inline font-medium text-ink-muted">
                      {summary.level?.label ?? "Not attempted yet"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-faint">Best: </dt>
                    <dd className="inline tabular-nums text-ink-muted">
                      {summary.bestPercentage !== null
                        ? `${summary.bestPercentage}%`
                        : "—"}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="inline text-ink-faint">Attempts: </dt>
                <dd className="inline tabular-nums text-ink-muted">
                  {summary.attemptCount}
                </dd>
              </div>
              <div>
                <dt className="inline text-ink-faint">Last: </dt>
                <dd className="inline text-ink-muted">
                  {formatDate(summary.lastAttemptAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Sitting the paper. When no paper exists in this area yet, the card
            says so plainly rather than showing a button that cannot work. */}
        {papers.length === 0 ? (
          <p className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs text-ink-muted">
            No {summary.label.toLowerCase()} paper has been published for your
            class yet. It appears here as soon as one is, and your score fills
            in on its own once you have sat it.
          </p>
        ) : openPaper ? (
          <StartAttemptButton
            assessmentId={openPaper.assessment.id}
            kind={openPaper.assessment.kind}
            resuming={Boolean(inProgress)}
          />
        ) : (
          blocked && (
            <p className="text-xs text-ink-faint">
              {AVAILABILITY_COPY[
                blocked.availability.open ? "not_published" : blocked.availability.reason
              ]}
            </p>
          )
        )}

        {attempts.length > 0 && (
          <div className="space-y-2">
            {!unscored && trend.length > 0 && (
              <details className="group rounded-lg border border-indigo-100">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-indigo-700 hover:underline">
                  View analysis
                </summary>
                <div className="space-y-2 border-t border-indigo-100 px-3 py-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-brass-700">
                    Your progress over time
                  </h4>
                  <ProgressLineChart trend={trend} label={summary.label} />
                  {improvement && (
                    <p className="text-xs font-medium text-ink-muted">
                      {improvement}
                    </p>
                  )}
                </div>
              </details>
            )}

            <details className="group rounded-lg border border-indigo-100">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-indigo-700 hover:underline">
                Attempt history
              </summary>
              <div className="overflow-x-auto border-t border-indigo-100 px-3 py-3">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    Every {summary.label} attempt you have submitted
                  </caption>
                  <thead>
                    <tr className="border-b border-indigo-100 text-[10px] uppercase tracking-wide text-ink-faint">
                      <th scope="col" className="py-1.5 pr-3 font-medium">Attempt</th>
                      <th scope="col" className="py-1.5 pr-3 font-medium">Date</th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-medium">Score</th>
                      <th scope="col" className="py-1.5 pr-3 font-medium">Time</th>
                      <th scope="col" className="py-1.5 pr-3 text-right font-medium">Correct</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Wrong</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...attempts]
                      .sort((a, b) => a.attemptNumber - b.attemptNumber)
                      .map((a) => (
                        <tr key={a.attemptNumber} className="border-b border-indigo-50">
                          <th scope="row" className="py-1.5 pr-3 font-medium text-indigo-950">
                            {a.attemptNumber}
                          </th>
                          <td className="py-1.5 pr-3 text-ink-muted">
                            {formatDate(a.submittedAt)}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">
                            {unscored
                              ? "—"
                              : a.percentage !== null
                                ? `${a.percentage}%`
                                : "Awaiting marking"}
                          </td>
                          <td className="py-1.5 pr-3 text-ink-muted">
                            {formatDuration(a.timeTakenSeconds)}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">
                            {a.correct ?? "—"}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-ink-muted">
                            {a.wrong ?? "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}

      </CardBody>
    </Card>
  );
}
