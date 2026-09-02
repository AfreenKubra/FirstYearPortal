import { Card, CardBody, CardHeader, ProgressBar, StatTile } from "@/components/ui/Card";
import {
  UNVERIFIED_NOTICE,
  VERIFIED_NOTICE,
  resourceKindLabel,
} from "@/config/resources";
import {
  MARKER_LABELS,
  daysBetween,
  describeCountdown,
  examTrack,
  formatDayLabel,
  todayISO,
} from "@/lib/roadmap/exam-track";
import type { Resource } from "@/lib/queries/resources";

/**
 * The dated exam track above a student's milestones.
 *
 * This is the answer to "when is the exam, and how many workshops are there
 * for it" — and the reason it lives here rather than inside the roadmap
 * generator is the portal's central rule. `ai-generate.ts` strips any
 * milestone that states a date, so the plan itself can never tell a student
 * when GATE is. Every date on this panel is read straight from
 * `resources.occurs_on` and its two registration columns, which only an
 * administrator can write. The AI frames prose; the database states facts.
 *
 * Three things this deliberately does not do:
 *
 *   - It does not render when nothing is tagged. An empty timeline shell
 *     implies the college has an exam track and simply forgot the dates.
 *   - It does not fill a missing date. A resource with an exam day and no
 *     registration window renders with two of the three markers absent, and
 *     `examTrack` returns `null` rather than a guess.
 *   - It does not merge the two workshop counts. Sessions on the college
 *     calendar and links in the catalogue are different promises — one has a
 *     room and a register, the other is a URL — and one combined number would
 *     let a student turn up expecting the first and find the second.
 */
export function ExamTrackPanel({
  exams,
  goalNames,
  workshopsOnCalendar,
  workshopsInCatalogue,
}: {
  /** Exam resources tagged to the student's goals, soonest first. */
  exams: Resource[];
  /** The goals the student picked, by name, for the panel's description. */
  goalNames: string[];
  /** Published, upcoming college events tagged to those goals. */
  workshopsOnCalendar: number;
  /** Catalogue entries of kind `workshop` tagged to those goals. */
  workshopsInCatalogue: number;
}) {
  if (exams.length === 0) return null;

  // Read once and threaded through every calculation below. Two calls to
  // `todayISO()` either side of midnight would disagree, and the panel would
  // render a countdown that contradicted the marker list beside it.
  const today = todayISO();

  // The soonest exam drives the headline countdown. The rest are listed, but
  // one countdown at a time is the honest reading of "when is the exam".
  const next = exams[0];
  const nextTrack = examTrack(
    {
      occursOn: next.occursOn,
      registrationOpensOn: next.registrationOpensOn,
      registrationClosesOn: next.registrationClosesOn,
    },
    today,
  );

  return (
    <section aria-labelledby="exam-track" className="space-y-4">
      <h2 id="exam-track" className="text-lg text-indigo-950">
        Your exam track
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Next exam"
          value={
            nextTrack.daysUntilExam === null
              ? "—"
              : nextTrack.daysUntilExam <= 0
                ? "Today"
                : `${nextTrack.daysUntilExam} days`
          }
          hint={
            nextTrack.daysUntilExam === null
              ? "Date not recorded"
              : (formatDayLabel(next.occursOn) ?? undefined)
          }
        />
        <StatTile
          label="Registration"
          value={registrationValue(nextTrack.registrationState)}
          hint={
            nextTrack.daysUntilRegistrationCloses === null
              ? "Closing date not recorded"
              : (describeCountdown(nextTrack.daysUntilRegistrationCloses) ??
                undefined)
          }
        />
        <StatTile
          label="Workshops on your calendar"
          value={String(workshopsOnCalendar)}
          hint={
            workshopsOnCalendar === 0
              ? "None tagged for your goals yet"
              : "Run by your college"
          }
        />
        <StatTile
          label="Workshops in the catalogue"
          value={String(workshopsInCatalogue)}
          hint={
            workshopsInCatalogue === 0
              ? "None tagged for your goals yet"
              : "Links, not sessions"
          }
        />
      </div>

      {exams.map((exam) => {
        const track = examTrack(
          {
            occursOn: exam.occursOn,
            registrationOpensOn: exam.registrationOpensOn,
            registrationClosesOn: exam.registrationClosesOn,
          },
          today,
        );

        return (
          <Card as="article" key={exam.id}>
            <CardHeader
              eyebrow={
                resourceKindLabel(exam.kind) +
                (exam.provider ? ` · ${exam.provider}` : "")
              }
              title={exam.title}
              description={
                goalNames.length > 0
                  ? `Tagged to ${goalNames.join(", ")}.`
                  : undefined
              }
              action={
                <span
                  title={exam.isVerified ? VERIFIED_NOTICE : UNVERIFIED_NOTICE}
                  className={[
                    "shrink-0 rounded-md border px-2 py-1 text-xs font-medium",
                    exam.isVerified
                      ? "border-success/30 bg-success/5 text-success"
                      : "border-warning/40 bg-warning/5 text-warning",
                  ].join(" ")}
                >
                  {exam.isVerified ? "Checked" : "Not checked"}
                </span>
              }
            />
            <CardBody className="space-y-4">
              {track.isEmpty ? (
                <p className="text-sm text-ink-muted">
                  No dates have been recorded for this yet. The link is below —
                  the official page is the only place a date is safe to read.
                </p>
              ) : (
                <>
                  {/* The bar only appears when two recorded dates give it a
                      span to measure. A single date is a point, and a bar
                      across a point would draw a duration nobody entered. */}
                  {track.elapsedPercent !== null && (
                    <ProgressBar
                      value={track.elapsedPercent}
                      label="How far through the recorded window you are"
                    />
                  )}

                  <ol className="space-y-2">
                    {track.markers.map((marker) => (
                      <li
                        key={marker.key}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <span
                          aria-hidden="true"
                          className={[
                            "grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[0.5rem] font-bold",
                            marker.reached
                              ? "border-brass-500 bg-brass-500 text-white"
                              : "border-indigo-200 bg-white text-transparent",
                          ].join(" ")}
                        >
                          ✓
                        </span>
                        <span className="text-ink-muted">
                          {MARKER_LABELS[marker.key]}
                        </span>
                        <span className="tabular-nums text-indigo-900">
                          {formatDayLabel(marker.date)}
                        </span>
                        <span className="text-xs text-ink-faint">
                          {describeCountdown(daysBetween(today, marker.date))}
                        </span>
                        <span className="sr-only">
                          {marker.reached ? "(passed)" : "(still ahead)"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {exam.description && (
                <p className="text-sm leading-relaxed text-ink-muted">
                  {exam.description}
                </p>
              )}

              <a
                href={exam.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded text-sm font-medium text-indigo-700 hover:underline"
              >
                Official page ↗
              </a>

              {!exam.isVerified && (
                <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                  {UNVERIFIED_NOTICE} Confirm the dates on the official page
                  before you plan around them.
                </p>
              )}
            </CardBody>
          </Card>
        );
      })}

      <p className="text-xs text-ink-faint">
        Dates here were entered by your college into the resource catalogue.
        They are shown exactly as recorded — nothing on this page estimates a
        date, so a missing one stays missing rather than becoming a guess.
      </p>
    </section>
  );
}

function registrationValue(
  state: ReturnType<typeof examTrack>["registrationState"],
) {
  if (state === "open") return "Open";
  if (state === "closed") return "Closed";
  if (state === "not-open") return "Not yet open";
  return "Not recorded";
}
