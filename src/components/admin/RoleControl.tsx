"use client";

import { useFormState } from "react-dom";
import { setRoles } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage } from "@/components/ui/FormStatus";
import { ROLES, ROLE_LABELS, isAllowlistedAdmin, type Role } from "@/config/roles";

/**
 * The roles one account holds.
 *
 * Roles are a set (migration 0012): the head of a department is also an
 * administrator, and the administrator also teaches. The radio column picks
 * the primary role — where the account lands at sign-in — and the checkboxes
 * pick everything it may additionally reach.
 *
 * Two roles are offered conditionally rather than always, because offering an
 * option that is guaranteed to be refused just invites the refusal:
 * Administrator only for allow-listed addresses, and the teaching roles only
 * where a staff record exists to render their portal from.
 */
export function RoleControl({
  userId,
  email,
  primaryRole,
  roles,
  name,
  hasStaffRecord,
  isSelf = false,
}: {
  userId: string;
  email: string;
  primaryRole: string;
  roles: string[];
  name: string;
  hasStaffRecord: boolean;
  isSelf?: boolean;
}) {
  const [state, formAction] = useFormState(setRoles, idleState);

  const available = ROLES.filter((role) => {
    if (role === "admin") return isAllowlistedAdmin(email);
    if (role === "faculty" || role === "hod") {
      // Already-held roles stay visible even without a staff record, so an
      // inconsistent account can be corrected rather than only displayed.
      return hasStaffRecord || roles.includes(role);
    }
    return true;
  });

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />

      <fieldset disabled={isSelf} className="space-y-1.5">
        <legend className="text-[0.6875rem] font-medium uppercase tracking-wide text-ink-faint">
          Roles<span className="sr-only"> for {name}</span>
        </legend>

        <table className="text-xs">
          <thead>
            <tr className="text-ink-faint">
              <th scope="col" className="pr-3 text-left font-normal">
                Role
              </th>
              <th scope="col" className="px-1.5 font-normal" title="Held">
                Has
              </th>
              <th
                scope="col"
                className="px-1.5 font-normal"
                title="Where they land at sign-in"
              >
                Home
              </th>
            </tr>
          </thead>
          <tbody>
            {available.map((role: Role) => (
              <tr key={role}>
                <th
                  scope="row"
                  className="pr-3 py-0.5 text-left font-normal text-ink-muted"
                >
                  {ROLE_LABELS[role]}
                </th>
                <td className="px-1.5 py-0.5 text-center">
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    defaultChecked={roles.includes(role)}
                    aria-label={`${name} holds ${ROLE_LABELS[role]}`}
                    className="h-3.5 w-3.5 accent-indigo-700"
                  />
                </td>
                <td className="px-1.5 py-0.5 text-center">
                  <input
                    type="radio"
                    name="primary"
                    value={role}
                    defaultChecked={primaryRole === role}
                    aria-label={`${ROLE_LABELS[role]} is where ${name} lands at sign-in`}
                    className="h-3.5 w-3.5 accent-brass-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="submit"
          className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-900 shadow-sm transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:bg-parchment-sunk disabled:text-ink-faint"
        >
          Save roles
        </button>
      </fieldset>

      {isSelf && (
        <p className="text-[0.6875rem] text-ink-faint">
          You cannot change your own roles.
        </p>
      )}

      <FormMessage state={state} />
    </form>
  );
}
