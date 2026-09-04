import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { STUDENT_VISIBLE_COMPONENT_CODES, type MarkComponent } from "@/config/marks";
import type { StudentSubjectMarks } from "@/lib/queries/marks";

/**
 * A student's own internal marks (migration 0025).
 *
 * A plain server-rendered table — there is nothing to interact with, and the
 * student cannot change any of it.
 *
 * Every subject on the student's scheme gets a row, whether or not anything
 * has been released for it yet — `getStudentMarks()` builds `subjects` from
 * `getSubjectsFor()`, not from which rows happen to exist in
 * `student_subject_marks`. An earlier version dropped a subject entirely
 * until its first component was released, reasoning that a row of dashes
 * would read as "you scored nothing" — the tradeoff was that a subject
 * missing from the list was indistinguishable from a subject that simply
 * wasn't on the scheme. Showing the full list and dashing individual cells
 * keeps that distinction visible instead.
 *
 * One rule the copy has to hold to: an unreleased or unmarked component
 * renders as an em dash, never a zero. On a marks card those are opposite
 * meanings, and the wrong one is alarming.
 *
 * Only the components in `STUDENT_VISIBLE_COMPONENT_CODES` are shown, and no
 * total is shown at all — a sum over a subset would read as a CIE while
 * silently omitting the components this card hides.
 */
export function StudentMarksTable({
  components,
  subjects,
}: {
  components: MarkComponent[];
  subjects: StudentSubjectMarks[];
}) {
  const visibleComponents = components.filter((component) =>
    STUDENT_VISIBLE_COMPONENT_CODES.includes(component.code),
  );
  // Only when the student has no scheme on file at all — never because
  // nothing has been released yet, which is now just every cell dashed.
  if (subjects.length === 0) {
    return (
      <Card as="section">
        <CardHeader title="Academic Internal Marks" />
        <CardBody>
          <EmptyState
            title="No subjects on file yet"
            description="Once your department's VTU scheme is added for your semester, your subjects appear here — marks blank until your faculty record and release them."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card as="section">
      <CardHeader title="Academic Internal Marks" />
      <CardBody className="space-y-3">
        {/* Sized to its content rather than stretched to the card's full
            width: with only three columns, `w-full` spread the mark columns
            to the far right, a long eye-track away from the subject they
            belong to. Ruled on every cell so it reads as a mark sheet. */}
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <caption className="sr-only">
              Your internal marks by subject, with one column per assessment
              component.
            </caption>
            <thead>
              <tr className="text-left">
                <th
                  scope="col"
                  className="border border-indigo-100 bg-indigo-50/40 px-3 py-2 font-medium text-ink-muted"
                >
                  Subject
                </th>
                {visibleComponents.map((component) => (
                  <th
                    key={component.code}
                    scope="col"
                    className="w-24 border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-center font-medium text-ink-muted"
                  >
                    {component.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.subjectId}>
                  <th
                    scope="row"
                    className="border border-indigo-100 px-3 py-2 text-left font-normal"
                  >
                    <span className="font-mono text-xs text-ink-muted">
                      {subject.subjectCode}
                    </span>
                    <span className="block text-ink">{subject.subjectName}</span>
                  </th>

                  {subject.cells
                    .filter((cell) =>
                      STUDENT_VISIBLE_COMPONENT_CODES.includes(cell.componentCode),
                    )
                    .map((cell) => (
                      <td
                        key={cell.componentCode}
                        className="border border-indigo-100 px-3 py-2 text-center tabular-nums"
                      >
                        {cell.marks === null ? (
                          <span className="text-ink-faint" aria-label="Not recorded">
                            —
                          </span>
                        ) : (
                          <span className="text-indigo-900">
                            {cell.marks}
                            <span className="text-ink-faint">/{cell.maxMarks}</span>
                          </span>
                        )}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
