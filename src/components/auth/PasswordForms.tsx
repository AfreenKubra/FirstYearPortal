"use client";

import { useFormState } from "react-dom";
import { requestPasswordReset, resetPassword } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/form-state";
import { TextInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, idleState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage state={state} />
      <TextInput
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@hkbk.edu.in"
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending…" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(resetPassword, idleState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage state={state} />
      <TextInput
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with upper and lower case, a number, and a symbol."
        error={state.fieldErrors?.password}
      />
      <TextInput
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel="Updating…" className="w-full">
        Update password
      </SubmitButton>
    </form>
  );
}
