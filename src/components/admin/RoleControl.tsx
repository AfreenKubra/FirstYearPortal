"use client";

import { useFormState } from "react-dom";
import { changeRole } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage } from "@/components/ui/FormStatus";
import { ROLES, ROLE_LABELS, isAllowlistedAdmin } from "@/config/roles";

/**
 * Role control for one account.
 *
 * This is the only route to a Head of Department account inside the portal:
 * register as faculty, get approved, then get promoted here. Administrator is
 * offered only for allow-listed addresses — the server action and a database
 * trigger both refuse the rest, and showing an option that is guaranteed to
 * fail would just invite the failure.
 */
export function RoleControl({
  userId,
  email,
  role,
  name,
  isSelf = false,
}: {
  userId: string;
  email: string;
  role: string;
  name: string;
  isSelf?: boolean;
}) {
  const [state, formAction] = useFormState(changeRole, idleState);

  const options = ROLES.filter(
    (candidate) => candidate !== "admin" || isAllowlistedAdmin(email),
  );

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="userId" value={userId} />

      <label
        htmlFor={`role-${userId}`}
        className="block text-[0.6875rem] font-medium uppercase tracking-wide text-ink-faint"
      >
        Role<span className="sr-only"> for {name}</span>
      </label>

      <div className="flex gap-2">
        <select
          id={`role-${userId}`}
          name="role"
          defaultValue={role}
          disabled={isSelf}
          className="h-9 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs text-ink shadow-sm disabled:cursor-not-allowed disabled:bg-parchment-sunk"
        >
          {options.map((candidate) => (
            <option key={candidate} value={candidate}>
              {ROLE_LABELS[candidate]}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isSelf}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-900 shadow-sm transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:bg-parchment-sunk disabled:text-ink-faint"
        >
          Change
        </button>
      </div>

      <FormMessage state={state} />
    </form>
  );
}
