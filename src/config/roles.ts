/**
 * Roles, their home routes, and the administrator allow-list.
 *
 * Defined once and imported by the middleware, the login actions, the
 * registration forms, and every role shell — the same reasoning as
 * `config/residence.ts`. A role added here without a home route is a
 * redirect loop waiting to happen, so the two are kept in one object.
 */

export const ROLES = ["student", "faculty", "hod", "admin"] as const;

export type Role = (typeof ROLES)[number];

/** Where a signed-in account of each role belongs. */
export const ROLE_HOME: Record<Role, string> = {
  student: "/dashboard",
  faculty: "/faculty",
  hod: "/hod",
  admin: "/admin",
};

/** How each role is named in the interface. */
export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty",
  hod: "Head of Department",
  admin: "Administrator",
};

/** Which role owns which path prefix. Order matters: longest prefix first. */
export const ROLE_PREFIXES: Array<{ prefix: string; role: Role }> = [
  { prefix: "/dashboard", role: "student" },
  { prefix: "/complete-profile", role: "student" },
  { prefix: "/achievements", role: "student" },
  { prefix: "/faculty", role: "faculty" },
  { prefix: "/hod", role: "hod" },
  { prefix: "/admin", role: "admin" },
];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function roleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return isRole(value) ? ROLE_LABELS[value] : value;
}

export function homeForRole(value: string | null | undefined): string {
  return isRole(value) ? ROLE_HOME[value] : "/dashboard";
}

/**
 * The complete set of roles an account holds (migration 0012).
 *
 * An account may hold several: the head of a department is also an
 * administrator, and the administrator also teaches. `users.role` is the
 * primary one — where they land at sign-in — and `user_roles` holds the rest.
 *
 * The primary role is folded in rather than trusted to be present in the
 * granted list. A database trigger keeps the two in step, but a row written
 * before 0012, or by a path that bypassed the trigger, would otherwise leave
 * the account locked out of its own home route — and a redirect loop is a far
 * worse failure than a duplicated set member.
 *
 * Unrecognised values are dropped rather than passed through: these decide
 * route access, so a role the application does not know about must not be
 * treated as one it does.
 */
export function mergeRoles(
  primary: string | null | undefined,
  granted: ReadonlyArray<{ role: string }> | null | undefined,
): Role[] {
  const held = new Set<Role>();
  if (isRole(primary)) held.add(primary);
  for (const row of granted ?? []) {
    if (isRole(row.role)) held.add(row.role);
  }
  return [...held];
}

// --- Administrator allow-list ------------------------------------------------

/**
 * The only addresses permitted to hold the `admin` role.
 *
 * This is a mirror of `public.admin_allowlist`, not the enforcement point —
 * the database trigger `users_guard_admin_allowlist` (migration 0011) is what
 * actually holds the line, and it would refuse the write even if this file
 * said otherwise. The copy exists so registration can refuse an administrator
 * request with a clear sentence instead of letting the caller hit a raw
 * Postgres exception, and so the approvals screen can grey out a decision it
 * knows will fail.
 *
 * Adding an administrator means changing both: a row in `admin_allowlist`
 * (service role only) and this list.
 */
export const ADMIN_ALLOWLIST: readonly string[] = [
  "hod.aiml@hkbk.edu.in",
  "afreenk.aiml@hkbk.edu.in",
];

export function isAllowlistedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_ALLOWLIST.includes(email.trim().toLowerCase());
}

// --- Staff roles -------------------------------------------------------------

/** Roles that a staff registration request may ask for. */
export const STAFF_ROLES = ["faculty", "hod"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Both staff roles carry a department. A HOD heads exactly one, and a faculty
 * member teaches in one — neither is institution-wide, which is what keeps
 * the `admin` role separate and allow-listed.
 */
export const STAFF_ROLE_CHOICES: Array<{
  value: StaffRole;
  label: string;
  hint: string;
}> = [
  {
    value: "faculty",
    label: "Faculty",
    hint: "Mentor and view the students assigned to you",
  },
  {
    value: "hod",
    label: "Head of Department",
    hint: "See and report on every student in your department",
  },
];
