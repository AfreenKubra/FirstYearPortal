"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createAssignment, deleteAssignment } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/form-state";
import { Select, TextInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";

type FacultyOption = {
  id: string;
  full_name: string;
  employee_code: string;
  department_code: string;
};

/**
 * Creates either kind of assignment (PRD 5.5).
 *
 * The scope/student toggle is a radio pair rather than two separate forms so
 * the admin sees both options exist. Leaving semester and section blank means
 * "all" — stated in the hint, because a blank field that silently means
 * "everything" is exactly the kind of thing that over-grants access by
 * accident.
 */
export function CreateAssignmentForm({
  faculty,
  departments,
}: {
  faculty: FacultyOption[];
  departments: Array<{ code: string; name: string }>;
}) {
  const [state, formAction] = useFormState(createAssignment, idleState);
  const [scopeType, setScopeType] = useState<"scope" | "student">("scope");

  if (faculty.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No faculty accounts exist yet. Once a faculty member registers and you
        approve their account, you can assign students to them here.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage state={state} />

      <Select
        label="Faculty member"
        name="facultyId"
        placeholder="Select a faculty member"
        options={faculty.map((f) => ({
          value: f.id,
          label: `${f.full_name} (${f.employee_code} · ${f.department_code})`,
        }))}
        error={state.fieldErrors?.facultyId}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-muted">
          Assignment type
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["scope", "A group", "Department, optionally narrowed by semester and section"],
              ["student", "One named student", "By USN — for mentoring groups that cut across sections"],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-indigo-100 bg-white px-3 py-2.5 text-sm transition-colors hover:border-indigo-300 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
            >
              <input
                type="radio"
                name="scopeType"
                value={value}
                checked={scopeType === value}
                onChange={() => setScopeType(value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-700"
              />
              <span>
                <span className="block font-medium text-indigo-950">{label}</span>
                <span className="block text-xs text-ink-faint">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {scopeType === "scope" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Department"
            name="departmentCode"
            placeholder="Select"
            options={departments.map((d) => ({ value: d.code, label: d.code }))}
            error={state.fieldErrors?.departmentCode}
          />
          <Select
            label="Semester"
            name="semester"
            placeholder="All semesters"
            options={[
              { value: 1, label: "Semester 1" },
              { value: 2, label: "Semester 2" },
            ]}
            hint="Blank = all"
          />
          <TextInput
            label="Section"
            name="section"
            placeholder="All sections"
            maxLength={4}
            className="uppercase"
            hint="Blank = all"
          />
        </div>
      ) : (
        <TextInput
          label="Student USN"
          name="studentUsn"
          placeholder="1HK24CS001"
          className="uppercase"
          error={state.fieldErrors?.studentUsn}
        />
      )}

      <label className="flex items-start gap-2.5 rounded-lg border border-brass-300/60 bg-brass-50 px-3.5 py-3 text-sm">
        <input
          type="checkbox"
          name="isMentor"
          className="mt-0.5 h-4 w-4 shrink-0 accent-brass-600"
        />
        <span>
          <span className="block font-medium text-brass-800">
            Assign as mentor
          </span>
          <span className="block text-xs text-brass-700">
            Mentors can see guardian contact details for these students. Leave
            unchecked for view-only access.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <SubmitButton>Create assignment</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAssignmentForm({ id }: { id: string }) {
  const [state, formAction] = useFormState(deleteAssignment, idleState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
      >
        Remove
      </button>
      <FormMessage state={state} />
    </form>
  );
}
