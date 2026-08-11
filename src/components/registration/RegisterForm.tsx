"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { registerStudent } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/form-state";
import {
  accountStepSchema,
  householdStepSchema,
  identityStepSchema,
} from "@/lib/validation/student";
import { CheckboxGroup, Select, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { INDIAN_STATES } from "@/config/states";
import { RESIDENCE_FIELD_LABEL, RESIDENCE_TYPES } from "@/config/residence";
import type { LookupOption } from "@/lib/queries/student";

type Props = {
  departments: Array<{ code: string; name: string }>;
  languages: LookupOption[];
};

const STEPS = [
  { title: "Account", blurb: "How you'll sign in" },
  { title: "About you", blurb: "Identity and contact" },
  { title: "Guardian details", blurb: "Guardian and consent" },
] as const;

/**
 * Multi-step registration (PRD 5.2).
 *
 * All three steps stay mounted and are hidden with the `hidden` attribute
 * rather than unmounted, so a single submit carries every field and the user
 * never loses typed input by stepping back. `noValidate` is required as a
 * consequence: the browser cannot focus a hidden invalid control, so native
 * validation would block submission with no visible explanation. Zod runs
 * per-step on the client and again in full on the server.
 */
export function RegisterForm({ departments, languages }: Props) {
  const [state, formAction] = useFormState(registerStudent, idleState);
  const [step, setStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Server-reported errors win: they are the authoritative pass.
  const errors = { ...stepErrors, ...(state.fieldErrors ?? {}) };

  function validateStep(index: number): boolean {
    const form = formRef.current;
    if (!form) return false;

    const data = new FormData(form);
    const get = (key: string) => (data.get(key) ?? "") as string;

    const schemas = [
      () =>
        accountStepSchema.safeParse({
          email: get("email"),
          username: get("username"),
          password: get("password"),
          confirmPassword: get("confirmPassword"),
        }),
      () =>
        identityStepSchema.safeParse({
          fullName: get("fullName"),
          dob: get("dob"),
          usn: get("usn"),
          phone: get("phone"),
          state: get("state"),
          city: get("city"),
          departmentCode: get("departmentCode"),
        }),
      () =>
        householdStepSchema.safeParse({
          guardianName: get("guardianName"),
          guardianPhone: get("guardianPhone"),
          residenceType: get("residenceType"),
          languageIds: data.getAll("languageIds").map(Number),
          consent: data.get("consent") === "on",
        }),
    ];

    const result = schemas[index]();
    if (result.success) {
      setStepErrors({});
      return true;
    }

    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!next[key]) next[key] = issue.message;
    }
    setStepErrors(next);
    return false;
  }

  function goNext() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="space-y-6">
      <ol className="flex gap-2" aria-label="Registration progress">
        {STEPS.map((entry, index) => {
          const status =
            index < step ? "done" : index === step ? "current" : "upcoming";
          return (
            <li key={entry.title} className="flex-1">
              <div
                aria-current={status === "current" ? "step" : undefined}
                className={[
                  "rounded-lg border px-3 py-2 transition-colors",
                  status === "current"
                    ? "border-indigo-300 bg-indigo-50"
                    : status === "done"
                      ? "border-brass-300 bg-brass-50"
                      : "border-indigo-100 bg-white",
                ].join(" ")}
              >
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-faint">
                  Step {index + 1}
                  <span className="sr-only">
                    {status === "done" ? " (complete)" : ""}
                  </span>
                </p>
                <p className="truncate text-sm font-medium text-indigo-950">
                  {entry.title}
                </p>
                <p className="hidden truncate text-xs text-ink-faint sm:block">
                  {entry.blurb}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <form ref={formRef} action={formAction} noValidate className="space-y-5">
        <FormMessage state={state} />

        {/* Step 1 — account */}
        <fieldset hidden={step !== 0} className="space-y-4">
          <legend className="sr-only">Account details</legend>
          <TextInput
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@hkbk.edu.in"
            error={errors.email}
          />
          <TextInput
            label="Username"
            name="username"
            autoComplete="username"
            hint="4–20 characters: lowercase letters, numbers, underscores."
            error={errors.username}
          />
          <TextInput
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with upper and lower case, a number, and a symbol."
            error={errors.password}
          />
          <TextInput
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword}
          />
        </fieldset>

        {/* Step 2 — identity */}
        <fieldset hidden={step !== 1} className="space-y-4">
          <legend className="sr-only">About you</legend>
          <TextInput
            label="Full name"
            name="fullName"
            autoComplete="name"
            placeholder="As printed on your admission record"
            error={errors.fullName}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Date of birth"
              name="dob"
              type="date"
              autoComplete="bday"
              error={errors.dob}
            />
            <TextInput
              label="USN"
              name="usn"
              placeholder="1HK24CS001"
              className="uppercase"
              error={errors.usn}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Mobile number"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="9880012345"
              error={errors.phone}
            />
            <Select
              label="Department"
              name="departmentCode"
              placeholder="Select your department"
              options={departments.map((d) => ({ value: d.code, label: d.name }))}
              error={errors.departmentCode}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="State"
              name="state"
              placeholder="Select your state"
              options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
              error={errors.state}
            />
            <TextInput
              label="City or town"
              name="city"
              autoComplete="address-level2"
              error={errors.city}
            />
          </div>
        </fieldset>

        {/* Step 3 — guardian details and consent */}
        <fieldset hidden={step !== 2} className="space-y-4">
          <legend className="sr-only">Guardian details and consent</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Parent or guardian's name"
              name="guardianName"
              error={errors.guardianName}
            />
            <TextInput
              label="Guardian's mobile number"
              name="guardianPhone"
              type="tel"
              inputMode="numeric"
              error={errors.guardianPhone}
            />
          </div>

          <Select
            label={RESIDENCE_FIELD_LABEL}
            name="residenceType"
            placeholder="Select where you live during term"
            options={RESIDENCE_TYPES.map((r) => ({
              value: r.value,
              label: r.label,
            }))}
            error={errors.residenceType}
          />

          <CheckboxGroup
            legend="Languages you know"
            name="languageIds"
            options={languages}
            error={errors.languageIds}
            columns={3}
          />

          <div className="rounded-lg border border-indigo-100 bg-parchment-sunk/60 p-4">
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                name="consent"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-indigo-300 accent-indigo-700"
              />
              <span>
                I consent to the college collecting and processing my academic,
                personal, and guardian details for student development,
                mentoring, and institutional reporting. See the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-indigo-700 underline hover:text-indigo-900"
                >
                  privacy notice
                </Link>
                .
              </span>
            </label>
            {errors.consent && (
              <p role="alert" className="mt-2 text-xs font-medium text-danger">
                {errors.consent}
              </p>
            )}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-3 border-t border-indigo-100 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
          >
            Back
          </Button>

          {isLastStep ? (
            <SubmitButton pendingLabel="Creating your account…">
              Create account
            </SubmitButton>
          ) : (
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
