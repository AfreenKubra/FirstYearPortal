import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { VTU_MIN_ATTENDANCE, type AttendanceSummary } from "@/lib/attendance/summary";

function Status({ below }: { below: boolean }) {
  // The words carry the meaning; colour only reinforces them.
  return below ? (
    <span className="inline-flex rounded-full border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs font-medium text-danger">
      Below {VTU_MIN_ATTENDANCE}%
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-success/30 bg-success/5 px-2 py-0.5 text-xs font-medium text-success">
      OK
    </span>
  );
}

/**
 * Class attendance: one overall figure, then each subject on its own line.
 *
 * Per subject matters more than overall. VTU's minimum applies to each
 * course separately, so a healthy overall percentage can sit above one
 * subject that would stop a student sitting its SEE — which is why a
 * subject below the line is flagged even when the overall figure is fine.
 */
export function AttendanceCard({ summary }: { summary: AttendanceSummary }) {
  return (
    <Card as="section">
      <CardHeader
        title="Attendance"
        description={`Classes attended out of classes held. VTU requires at least ${VTU_MIN_ATTENDANCE}% in each subject to sit its semester-end exam.`}
      />
      <CardBody>
        {!summary.overall ? (
          <EmptyState
            title="No attendance recorded yet"
            description="Your attendance appears here once your subject teachers add it."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Overall</p>
                <p className="text-3xl font-semibold tabular-nums text-indigo-950">
                  {summary.overall.percent}%
                </p>
                <p className="text-xs text-ink-muted tabular-nums">
                  {summary.overall.attended} of {summary.overall.held} classes
                </p>
              </div>
              {summary.belowMinimumCount > 0 ? (
                <p className="max-w-xs text-sm font-medium text-danger">
                  {summary.belowMinimumCount === 1
                    ? "1 subject is"
                    : `${summary.belowMinimumCount} subjects are`}{" "}
                  below {VTU_MIN_ATTENDANCE}% — the minimum applies to each subject on its own.
                </p>
              ) : (
                <Status below={false} />
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Attendance in each subject</caption>
                <thead>
                  <tr className="border-b border-indigo-100 text-xs uppercase tracking-wide text-ink-faint">
                    <th scope="col" className="py-2 pr-3 font-medium">Subject</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Attended</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">%</th>
                    <th scope="col" className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.subjects.map((s) => (
                    <tr key={s.subjectId} className="border-b border-indigo-50">
                      <th scope="row" className="py-2 pr-3 font-normal">
                        <span className="font-mono text-xs text-ink-faint">{s.code}</span>
                        <span className="block text-ink">{s.name}</span>
                      </th>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">
                        {s.attended} / {s.held}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums text-indigo-950">
                        {s.percent}%
                      </td>
                      <td className="py-2">
                        <Status below={s.belowMinimum} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
