import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isRole, mergeRoles, type Role } from "@/config/roles";

export type Viewer = {
  userId: string;
  email: string;
  /** Where this account lands at sign-in. */
  primaryRole: Role;
  /** Every role held — what actually decides access. */
  roles: Role[];
  status: string;
};

/**
 * The signed-in account's identity and full role set.
 *
 * An account may hold several roles (migration 0012): the head of a
 * department is also an administrator, and the administrator also teaches.
 * `users.role` remains the primary one — it decides the home route and how
 * the account is labelled — while `user_roles` decides what they may reach.
 *
 * The primary role is folded into the set rather than assumed present, for
 * the same reason the middleware does it: a row written before 0012, or by a
 * path that bypassed the sync trigger, would otherwise be locked out of its
 * own home route.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: account }, { data: granted }] = await Promise.all([
    supabase.from("users").select("email, role, status").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!account || !isRole(account.role)) return null;

  return {
    userId: user.id,
    email: account.email,
    primaryRole: account.role,
    roles: mergeRoles(account.role, granted),
    status: account.status,
  };
}

/** True when the signed-in account holds `role` and is active. */
export async function viewerHasRole(role: Role): Promise<boolean> {
  const viewer = await getViewer();
  return viewer !== null && viewer.status === "active" && viewer.roles.includes(role);
}
