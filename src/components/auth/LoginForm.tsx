"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { login } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/form-state";
import { TextInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";

export function LoginForm() {
  const [state, formAction] = useFormState(login, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <TextInput
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@hkbk.edu.in"
        required
        error={state.fieldErrors?.email}
      />

      <div className="space-y-1.5">
        <TextInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="rounded text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
