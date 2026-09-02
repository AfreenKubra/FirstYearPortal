"use client";

import { useFormState } from "react-dom";
import {
  assignSubjectTeacher,
  removeSubjectTeacher,
} from "@/lib/actions/marks";
import { idleState } from "@/lib/actions/form-state";
import { Select, TextInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import type { SubjectAssignment } from "@/lib/queries/marks";
import type { VtuSubject } from "@/lib/queries/vtu";

/**
 * Assigning who teaches a subject, which is what decides who may mark it
 * (migration 0026).
 *
 * Until a subject has a row here only the head of department and
 * administrators can enter its marks. That is a deliberate fallback rather
 * than a lockout — somebody accountable can always mark — but it does mean an
 * empty table has a consequence, so the copy says so rather than leaving a
 * faculty member to discover it from an empty subject picker.
 */
export function SubjectTeacherForm({
  subjects,
  faculty,
  assignments,
}: {
  subjects: VtuSubject[];
  faculty: Array<{ id: string; fullName: string; email: string; departmentCode: string }>;
  assignments: SubjectAssignment[];
}) {
  const [state, formAction] = useFormState(assignSubjectTeacher, idleState);
  const [removeState, removeAction] = useFormState(
    removeSubjectTeacher,
    idleState,
  );

  const active = subjects.filter((s) => s.isActive);

  return (
    <div className="space-y-5">
      <FormMessage state={state} />
      <FormMessage state={removeState} />

      {active.length === 0 || faculty.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {active.length === 0
            ? "Add a subject above before assigning anyone to teach it."
            : "No staff records to assign yet."}
        </p>
      ) : (
        <form action={formAction} noValidate className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Select
              label="Subject"
              name="subjectId"
              placeholder="Choose a subject"
              options={active.map((s) => ({
                value: s.id,
                label: `${s.departmentCode} sem ${s.semester} · ${s.code} — ${s.name}`,
              }))}
            />
          </div>
          <Select
            label="Teacher"
            name="facultyId"
            placeholder="Choose a member of staff"
            options={faculty.map((f) => ({
              value: f.id,
              label: `${f.fullName} (${f.departmentCode})`,
            }))}
          />
          <TextInput
            label="Section"
            name="section"
            maxLength={4}
            placeholder="All"
            hint="Blank means every section"
          />
          <div className="sm:col-span-4">
            <SubmitButton>Assign teacher</SubmitButton>
          </div>
        </form>
      )}

      {assignments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">Current teaching assignments</caption>
            <thead>
              <tr className="border-b border-indigo-100 text-left text-xs uppercase tracking-wide text-ink-faint">
                <th scope="col" className="py-2 pr-3 font-medium">Subject</th>
                <th scope="col" className="py-2 pr-3 font-medium">Teacher</th>
                <th scope="col" className="py-2 pr-3 font-medium">Section</th>
                <th scope="col" className="py-2 text-right font-medium">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50">
              {assignments.map((row) => (
                <tr key={`${row.subjectId}:${row.facultyId}:${row.section ?? "all"}`}>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-indigo-900">
                      {row.subjectCode}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {row.departmentCode} · sem {row.semester}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{row.facultyName}</td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {row.section ?? "All"}
                  </td>
                  <td className="py-2 text-right">
                    <form action={removeAction} className="inline">
                      <input type="hidden" name="subjectId" value={row.subjectId} />
                      <input type="hidden" name="facultyId" value={row.facultyId} />
                      <input
                        type="hidden"
                        name="section"
                        value={row.section ?? ""}
                      />
                      <SubmitButton
                        variant="secondary"
                        size="sm"
                        pendingLabel="Removing…"
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
