"use client";

import { useFormState } from "react-dom";
import { createDepartment, setDepartmentActive } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/form-state";
import { TextInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";

export function CreateDepartmentForm() {
  const [state, formAction] = useFormState(createDepartment, idleState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <TextInput
          label="Code"
          name="code"
          placeholder="CSE"
          className="uppercase"
          maxLength={10}
          error={state.fieldErrors?.code}
        />
        <TextInput
          label="Department name"
          name="name"
          placeholder="Computer Science & Engineering"
          error={state.fieldErrors?.name}
        />
      </div>
      <div className="flex justify-end">
        <SubmitButton>Add department</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Deactivate rather than delete.
 *
 * Departments are referenced by every student row, so a delete would either
 * fail on the foreign key or orphan records. Deactivating keeps history intact
 * and simply removes the option from future registrations.
 */
export function ToggleDepartmentForm({
  code,
  isActive,
  studentCount,
}: {
  code: string;
  isActive: boolean;
  studentCount: number;
}) {
  const [state, formAction] = useFormState(setDepartmentActive, idleState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        className={[
          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
          isActive
            ? "border-danger/40 text-danger hover:bg-danger/5"
            : "border-success/40 text-success hover:bg-success/5",
        ].join(" ")}
      >
        {isActive ? "Deactivate" : "Activate"}
      </button>
      {isActive && studentCount > 0 && (
        <span className="text-[0.6875rem] text-ink-faint">
          {studentCount} student{studentCount === 1 ? "" : "s"} keep their record
        </span>
      )}
      <FormMessage state={state} />
    </form>
  );
}
