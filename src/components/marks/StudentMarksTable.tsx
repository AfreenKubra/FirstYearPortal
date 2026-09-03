import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { SUM_DISCLAIMER, SUM_LABEL, type MarkComponent } from "@/config/marks";
import type { StudentSubjectMarks } from "@/lib/queries/marks";

/**
 * A student's own internal marks (migration 0025).
 *
 * A plain server-rendered table — there is nothing to interact with, and the
 * student cannot change any of it.
 *
 * Two rules the copy has to hold to:
 *
 *  1. An unreleased or unmarked component renders as an em dash, never a
 *     zero. On a marks card those are opposite meanings, and the wrong one is
 *     alarming.
 *  2. The total is labelled as the sum of what is recorded, never as CIE. VTU
 *     calculates CIE from the scheme, with weighting and scaling this portal
 *     does not know — see `config/marks.ts`.
 */
export function StudentMarksTable({
  components,
  subjects,
}: {
  components: MarkComponent[];
  subjects: StudentSubjectMarks[];
}) {
  // Nothing released yet still renders the section, with an empty state
  // saying who fills it and when — the same treatment the assessment list
  // below it gets.
  //
  // It deliberately does NOT render the table with every cell dashed. That
  // would show a student a grid of blanks against subjects nobody has marked,
  // which reads as "you scored nothing" far more readily than "nothing has
  // been entered". An empty state says the second thing without the first
  // being available to misread.
  if (subjects.length === 0) {
    return (
      <Card as="section">
        <CardHeader
          title="Internal marks"
          description="Your IA, assignment, and activity marks appear here."
        />
        <CardBody>
          <EmptyState
            title="No marks released yet"
            description={
              components.length > 0
                ? `When your faculty record and release them, they appear here subject by subject, with each component separately: ${components
                    .map((c) => `${c.label} (out of ${c.maxMarks})`)
                    .join(", ")}.`
                : "When your faculty record and release your internal marks, they appear here subject by subject."
            }
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card as="section">
      <CardHeader
        title="Internal marks"
        description="Marks your faculty have recorded and released. Blank means not yet marked or not yet released."
      />
      <CardBody className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">
              Your internal marks by subject, with one column per assessment
              component.
            </caption>
            <thead>
              <tr className="border-b border-indigo-100 text-left">
                <th scope="col" className="py-2 pr-3 font-medium text-ink-muted">
                  Subject
                </th>
                {components.map((component) => (
                  <th
                    key={component.code}
                    scope="col"
                    className="py-2 pr-3 text-center font-medium text-ink-muted"
                  >
                    {component.label}
                    <span className="block text-[0.625rem] font-normal text-ink-faint">
                      out of {component.maxMarks}
                    </span>
                  </th>
                ))}
                <th scope="col" className="py-2 text-right font-medium text-ink-muted">
                  Sum
                </th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr
                  key={subject.subjectId}
                  className="border-b border-indigo-50 last:border-0"
                >
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="font-mono text-xs text-ink-muted">
                      {subject.subjectCode}
                    </span>
                    <span className="block text-ink">{subject.subjectName}</span>
                  </th>

                  {subject.cells.map((cell) => (
                    <td
                      key={cell.componentCode}
                      className="py-2 pr-3 text-center tabular-nums"
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

                  <td className="py-2 text-right font-medium tabular-nums text-indigo-900">
                    {subject.outOf === 0
                      ? "—"
                      : `${subject.scored}/${subject.outOf}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          <span className="font-medium text-indigo-900">{SUM_LABEL}.</span>{" "}
          {SUM_DISCLAIMER}
        </p>
      </CardBody>
    </Card>
  );
}
