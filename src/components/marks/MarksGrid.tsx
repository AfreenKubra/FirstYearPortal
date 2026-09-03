"use client";

import { useFormState } from "react-dom";
import { releaseComponent, saveMarks } from "@/lib/actions/marks";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { AUTHORSHIP_NOTICE, SUM_LABEL } from "@/config/marks";
import { sumRecorded } from "@/lib/marks/compute";
import type { MarksGrid as MarksGridData } from "@/lib/queries/marks";

/**
 * Entering a class's internal marks, one subject at a time (migration 0025).
 *
 * One form over the whole grid rather than a form per cell: a faculty member
 * marks a paper for the whole class in one sitting, and a save per cell would
 * be sixty round trips and sixty chances to lose one. It is a plain
 * `<form action={...}>`, so it works without client JS — the same
 * progressive-enhancement trade as `ProfileSectionForm`.
 *
 * Release is deliberately outside that form (and a separate action): saving
 * and publishing are different decisions, and a faculty member part-way
 * through marking needs to save without showing anyone.
 */
export function MarksGrid({
  subjectId,
  subjectLabel,
  grid,
}: {
  subjectId: string;
  subjectLabel: string;
  grid: MarksGridData;
}) {
  const [state, formAction] = useFormState(saveMarks, idleState);
  const [releaseState, releaseAction] = useFormState(
    releaseComponent,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  if (grid.students.length === 0) {
    return (
      <Card>
        <CardHeader title={subjectLabel} />
        <CardBody>
          <EmptyState
            title="No students in scope"
            description="Nobody you can see is registered for this subject's department and semester. A faculty member needs an assignment covering them; a head of department sees their whole department."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card as="section">
        <CardHeader
          title={subjectLabel}
          description={AUTHORSHIP_NOTICE}
          eyebrow={`${grid.students.length} students`}
        />
        <CardBody className="space-y-4">
          <FormMessage state={state} />

          <form action={formAction} noValidate className="space-y-4">
            <input type="hidden" name="subjectId" value={subjectId} />

            {/* Wide on purpose: the table scrolls inside its own container
                rather than making the page scroll sideways. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">
                  Internal marks for {subjectLabel}. One column per component;
                  leave a cell blank if the student has not been marked.
                </caption>
                <thead>
                  <tr className="border-b border-indigo-100 text-left">
                    <th scope="col" className="py-2 pr-3 font-medium text-ink-muted">
                      USN
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium text-ink-muted">
                      Name
                    </th>
                    {grid.components.map((component) => (
                      <th
                        key={component.code}
                        scope="col"
                        className="py-2 pr-3 text-center font-medium text-ink-muted"
                      >
                        {component.label}
                        <span className="block text-[0.625rem] font-normal text-ink-faint">
                          out of {component.maxMarks}
                          {grid.releasedComponents.includes(component.code) &&
                            " · released"}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="py-2 text-right font-medium text-ink-muted">
                      Sum
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grid.students.map((student) => {
                    const { scored, outOf } = sumRecorded(student.cells);

                    return (
                      <tr
                        key={student.studentId}
                        className="border-b border-indigo-50 last:border-0"
                      >
                        <td className="py-2 pr-3 font-mono text-xs text-ink-muted">
                          {student.usn}
                        </td>
                        <td className="py-2 pr-3 text-ink">{student.fullName}</td>

                        {student.cells.map((cell) => {
                          const field = `mark:${student.studentId}:${cell.componentCode}`;
                          const error = errors[field];

                          return (
                            <td key={cell.componentCode} className="py-1.5 pr-3">
                              <input
                                type="text"
                                inputMode="decimal"
                                name={field}
                                defaultValue={cell.marks ?? ""}
                                aria-label={`${cell.componentCode} for ${student.fullName}, out of ${cell.maxMarks}`}
                                aria-invalid={error ? true : undefined}
                                className={[
                                  "h-9 w-16 rounded-lg border bg-white px-2 text-center text-sm tabular-nums",
                                  "shadow-sm transition-colors",
                                  error
                                    ? "border-danger focus:border-danger"
                                    : "border-indigo-200 hover:border-indigo-300 focus:border-indigo-500",
                                ].join(" ")}
                              />
                            </td>
                          );
                        })}

                        <td className="py-2 text-right tabular-nums text-ink-muted">
                          {outOf === 0 ? "—" : `${scored}/${outOf}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-ink-faint">
              Blank means not marked, which is not the same as zero. {SUM_LABEL}{" "}
              is shown per student — the portal does not calculate CIE.
            </p>

            <SubmitButton>Save marks</SubmitButton>
          </form>
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Release to students"
          description="Students see a component only once it is released. Release a whole column at a time, so nobody sees a half-marked class."
        />
        <CardBody className="space-y-3">
          <FormMessage state={releaseState} />

          <div className="flex flex-wrap gap-2">
            {grid.components.map((component) => {
              const isReleased = grid.releasedComponents.includes(
                component.code,
              );

              return (
                <form key={component.code} action={releaseAction}>
                  <input type="hidden" name="subjectId" value={subjectId} />
                  <input
                    type="hidden"
                    name="componentCode"
                    value={component.code}
                  />
                  <input
                    type="hidden"
                    name="withdraw"
                    value={isReleased ? "true" : "false"}
                  />
                  <SubmitButton
                    variant={isReleased ? "secondary" : "primary"}
                    size="sm"
                    pendingLabel="Working…"
                  >
                    {isReleased
                      ? `Withdraw ${component.label}`
                      : `Release ${component.label}`}
                  </SubmitButton>
                </form>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
