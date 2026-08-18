import Link from "next/link";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/config/roles";

/**
 * Moves between the areas an account is entitled to.
 *
 * Only rendered for accounts holding more than one role — which at this
 * institution is the normal case for senior staff: the head of AIML is also a
 * portal administrator, and the administrator also teaches. Without this they
 * would have to sign out and back in through a different entrance to reach
 * their other portal, which is the kind of friction people work around by
 * keeping two browsers open.
 *
 * Rendering a link here grants nothing. Middleware re-checks the role set on
 * the request, and RLS re-checks it again in the database, so a hand-typed
 * URL to an area the account does not hold is refused exactly as before.
 */
export function PortalSwitcher({
  roles,
  current,
}: {
  roles: Role[];
  /** The area being viewed, so it can be marked and not linked to itself. */
  current: Role;
}) {
  // `student` is never a portal a staff account switches into — the student
  // area is gated on a completed first-year profile that staff do not have.
  const targets = roles.filter((role) => role !== "student");
  if (targets.length < 2) return null;

  return (
    <nav
      aria-label="Switch portal"
      className="border-b border-indigo-100 px-3 py-3"
    >
      <p className="mb-1.5 px-1 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-faint">
        Your portals
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {targets.map((role) => {
          const active = role === current;
          return (
            <li key={role}>
              {active ? (
                <span
                  aria-current="page"
                  className="inline-flex rounded-lg border border-brass-300/60 bg-brass-50 px-2.5 py-1 text-xs font-medium text-brass-800"
                >
                  {ROLE_LABELS[role]}
                </span>
              ) : (
                <Link
                  href={ROLE_HOME[role]}
                  className="inline-flex rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-50"
                >
                  {ROLE_LABELS[role]}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
