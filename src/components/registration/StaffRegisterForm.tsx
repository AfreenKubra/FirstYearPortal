"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { registerStaff } from "@/lib/actions/faculty";
import { idleState } from "@/lib/actions/form-state";
import { DESIGNATIONS } from "@/lib/validation/faculty";
import { STAFF_ROLE_CHOICES, type StaffRole } from "@/config/roles";
import { Select, TextInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";

/**
 * One form for both self-service staff roles.
 *
 * Administrator is deliberately absent. Since migration 0011 the role is
 * restricted to an allow-list held in the database, so offering it here would
 * be offering something almost every visitor would be refused — and a request
 * that cannot succeed is worse than no request at all.
 */
export function StaffRegisterForm({
  departments,
}: {
  departments: Array<{ code: string; name: string }>;
}) {
  const [state, formAction] = useFormState(registerStaff, idleState);
  const [role, setRole] = useState<StaffRole>("faculty");
  const errors = state.fieldErrors ?? {};

  // A head of department's designation is not a choice — it is the role.
  const designations =
    role === "hod" ? (["Head of Department"] as const) : DESIGNATIONS;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage state={state} />

      <div className="rounded-lg border border-brass-300/60 bg-brass-50 px-3.5 py-2.5 text-sm text-brass-800">
        Staff accounts are never self-service. Your request goes to an existing
        administrator, and you can sign in once it is approved.
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-muted">
          I am requesting access as
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {STAFF_ROLE_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-indigo-100 bg-white px-3 py-2.5 text-sm transition-colors hover:border-indigo-300 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
            >
              <input
                type="radio"
                name="staffRole"
                value={choice.value}
                checked={role === choice.value}
                onChange={() => setRole(choice.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-700"
              />
              <span>
                <span className="block font-medium text-indigo-950">
                  {choice.label}
                </span>
                <span className="block text-xs text-ink-faint">
                  {choice.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.staffRole && (
          <p role="alert" className="text-xs font-medium text-danger">
            {errors.staffRole}
          </p>
        )}
      </fieldset>

      <TextInput
        label="Full name"
        name="fullName"
        autoComplete="name"
        error={errors.fullName}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Employee code"
          name="employeeCode"
          className="uppercase"
          error={errors.employeeCode}
        />
        <Select
          label="Designation"
          name="designation"
          placeholder="Select your designation"
          options={designations.map((d) => ({ value: d, label: d }))}
          error={errors.designation}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Official email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@hkbk.edu.in"
          error={errors.email}
        />
        <TextInput
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="numeric"
          error={errors.phone}
        />
      </div>

      <Select
        label={role === "hod" ? "Department you head" : "Department"}
        name="departmentCode"
        placeholder="Select your department"
        options={departments.map((d) => ({ value: d.code, label: d.name }))}
        error={errors.departmentCode}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="8+ characters, upper and lower case, a number, and a symbol."
          error={errors.password}
        />
        <TextInput
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
      </div>

      <SubmitButton pendingLabel="Submitting…" className="w-full">
        Request {role === "hod" ? "a head of department" : "a faculty"} account
      </SubmitButton>
    </form>
  );
}
