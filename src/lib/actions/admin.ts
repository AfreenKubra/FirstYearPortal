"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnAdmin } from "@/lib/queries/admin";
import { isAllowlistedAdmin, roleLabel } from "@/config/roles";
import { fieldErrorsFrom, type ActionState } from "./form-state";

/**
 * Admin mutations (PRD 5.6).
 *
 * Two rules hold for everything in this file:
 *
 *  1. `requireAdmin()` runs first. RLS would refuse the write anyway, but
 *     failing here gives a real message instead of a silent zero-row update,
 *     and it stops a non-admin learning anything from timing.
 *  2. Every privileged write is followed by an audit entry, written with the
 *     service role — `audit_logs` has no INSERT policy, so a session cannot
 *     forge or suppress a record of what it just did (PRD 5.1).
 */

async function requireAdmin() {
  const admin = await getOwnAdmin();
  if (!admin) return null;
  return admin;
}

async function writeAudit(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const service = createAdminClient();
    await service.from("audit_logs").insert({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch {
    // An audit write must never take down the operation the admin actually
    // asked for. Failures here are visible as a gap in the log rather than a
    // failed approval, which is the lesser of the two harms.
  }
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// --- Account approval -------------------------------------------------------

const accountDecisionSchema = z.object({
  userId: z.string().uuid("Invalid account."),
  decision: z.enum(["active", "rejected", "suspended"], {
    errorMap: () => ({ message: "Unknown decision." }),
  }),
});

export async function decideAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const parsed = accountDecisionSchema.safeParse({
    userId: formData.get("userId"),
    decision: formData.get("decision"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Could not apply that decision.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const actorId = await currentUserId();
  if (parsed.data.userId === actorId) {
    // Without this an admin can suspend themselves and lock the institution
    // out of its own portal, with no other admin necessarily existing.
    return {
      status: "error",
      message: "You cannot change the status of your own account.",
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ status: parsed.data.decision })
    .eq("id", parsed.data.userId);

  if (error) {
    return { status: "error", message: "Could not update that account." };
  }

  await writeAudit(actorId, `account.${parsed.data.decision}`, "users", parsed.data.userId, {
    decidedBy: admin.employeeCode,
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/admin");

  const outcome =
    parsed.data.decision === "active"
      ? "accepted — they can sign in now"
      : parsed.data.decision === "rejected"
        ? "declined — they cannot sign in"
        : "suspended — they cannot sign in";

  return { status: "success", message: `Account ${outcome}.` };
}

// --- Role changes -----------------------------------------------------------

const ROLE_VALUES = ["student", "faculty", "hod", "admin"] as const;

const roleSetSchema = z.object({
  userId: z.string().uuid("Invalid account."),
  primary: z.enum(ROLE_VALUES, {
    errorMap: () => ({ message: "Choose a primary role." }),
  }),
  roles: z.array(z.enum(ROLE_VALUES)).min(1, "An account needs at least one role."),
});

/**
 * Sets the complete role set for an account (migration 0012).
 *
 * Roles are a set here, not a single value: the head of a department is also
 * an administrator, and the administrator also teaches. `primary` decides
 * where the account lands at sign-in and how it is labelled; the rest decide
 * which areas it may enter.
 *
 * Reconciles rather than replaces wholesale — revoking every row and
 * re-inserting would briefly leave the account with no roles at all, and an
 * administrator editing their own institution's access should never pass
 * through a state where nobody can administer it.
 */
export async function setRoles(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const submitted = formData.getAll("roles").map(String);
  const primary = String(formData.get("primary") ?? "");

  const parsed = roleSetSchema.safeParse({
    userId: formData.get("userId"),
    primary,
    // The primary role is always part of the set — a home route the account
    // may not enter is a redirect loop.
    roles: Array.from(new Set([primary, ...submitted])),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Could not change those roles.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const actorId = await currentUserId();
  if (parsed.data.userId === actorId) {
    return { status: "error", message: "You cannot change your own roles." };
  }

  const supabase = createClient();

  const { data: target } = await supabase
    .from("users")
    .select("email, role")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  if (!target) {
    return { status: "error", message: "That account no longer exists." };
  }

  if (
    parsed.data.roles.includes("admin") &&
    !isAllowlistedAdmin(target.email)
  ) {
    return {
      status: "error",
      message:
        `${target.email} is not on the administrator allow-list, so it ` +
        "cannot be given that role. Add the address to admin_allowlist first.",
    };
  }

  // Faculty and HOD both render from a `faculty` row. Granting either to an
  // account without one produces a login that authenticates and then has no
  // shell to land in.
  if (parsed.data.roles.some((role) => role === "faculty" || role === "hod")) {
    const { data: staffRow } = await supabase
      .from("faculty")
      .select("id")
      .eq("user_id", parsed.data.userId)
      .maybeSingle();

    if (!staffRow) {
      return {
        status: "error",
        message:
          "That account has no staff record, so it cannot hold a teaching " +
          "role. Ask them to register at /register/staff first.",
      };
    }
  }

  const { data: existing } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", parsed.data.userId);

  const held = new Set((existing ?? []).map((r) => r.role));
  const wanted = new Set(parsed.data.roles);

  const toAdd = parsed.data.roles.filter((role) => !held.has(role));
  const toRemove = [...held].filter((role) => !wanted.has(role));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("user_roles")
      .insert(toAdd.map((role) => ({ user_id: parsed.data.userId, role })));

    if (error) {
      return {
        status: "error",
        message: /allow-list/i.test(error.message)
          ? "Administrator access is limited to the approved allow-list."
          : "Could not grant those roles.",
      };
    }
  }

  if (parsed.data.primary !== target.role) {
    const { error } = await supabase
      .from("users")
      .update({ role: parsed.data.primary })
      .eq("id", parsed.data.userId);

    if (error) {
      return { status: "error", message: "Could not set the primary role." };
    }
  }

  // Removals go last: the primary role is written above and the sync trigger
  // re-adds it, so deleting first would drop a row that is about to return.
  if (toRemove.length > 0) {
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", parsed.data.userId)
      .in("role", toRemove);
  }

  await writeAudit(actorId, "account.roles_set", "users", parsed.data.userId, {
    primary: parsed.data.primary,
    roles: parsed.data.roles,
    decidedBy: admin.employeeCode,
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/admin");

  return {
    status: "success",
    message: `${target.email}: ${parsed.data.roles
      .map((r) => roleLabel(r))
      .join(", ")} (primary ${roleLabel(parsed.data.primary)}).`,
  };
}

// --- Departments ------------------------------------------------------------

const departmentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Enter a short code.")
    .max(10, "Codes should be short, e.g. CSE.")
    .regex(/^[A-Z0-9]+$/, "Use letters and numbers only."),
  name: z.string().trim().min(3, "Enter the full department name.").max(120),
});

export async function createDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const parsed = departmentSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = createClient();
  const { error } = await supabase.from("departments").insert(parsed.data);

  if (error) {
    const message = /duplicate key|unique/i.test(error.message)
      ? "A department with that code already exists."
      : "Could not create that department.";
    return { status: "error", message };
  }

  await writeAudit(
    await currentUserId(),
    "department.create",
    "departments",
    parsed.data.code,
    { name: parsed.data.name },
  );

  revalidatePath("/admin/departments");
  return { status: "success", message: `${parsed.data.code} created.` };
}

export async function setDepartmentActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const code = String(formData.get("code") ?? "").trim();
  const active = formData.get("active") === "true";
  if (!code) return { status: "error", message: "Unknown department." };

  const supabase = createClient();
  const { error } = await supabase
    .from("departments")
    .update({ is_active: active })
    .eq("code", code);

  if (error) {
    return { status: "error", message: "Could not update that department." };
  }

  await writeAudit(
    await currentUserId(),
    active ? "department.activate" : "department.deactivate",
    "departments",
    code,
  );

  revalidatePath("/admin/departments");
  return {
    status: "success",
    message: `${code} ${active ? "activated" : "deactivated"}.`,
  };
}

// --- Faculty assignments ----------------------------------------------------

const assignmentSchema = z
  .object({
    facultyId: z.string().uuid("Select a faculty member."),
    scopeType: z.enum(["scope", "student"]),
    departmentCode: z.string().trim().optional(),
    semester: z.string().trim().optional(),
    section: z.string().trim().optional(),
    studentUsn: z.string().trim().optional(),
    isMentor: z.boolean(),
  })
  .refine(
    (v) =>
      v.scopeType === "student"
        ? Boolean(v.studentUsn)
        : Boolean(v.departmentCode),
    {
      path: ["departmentCode"],
      message: "Choose a department, or switch to assigning a named student.",
    },
  );

export async function createAssignment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const parsed = assignmentSchema.safeParse({
    facultyId: formData.get("facultyId"),
    scopeType: formData.get("scopeType") ?? "scope",
    departmentCode: formData.get("departmentCode") ?? undefined,
    semester: formData.get("semester") ?? undefined,
    section: formData.get("section") ?? undefined,
    studentUsn: formData.get("studentUsn") ?? undefined,
    isMentor: formData.get("isMentor") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const values = parsed.data;
  const supabase = createClient();

  let studentId: string | null = null;
  if (values.scopeType === "student") {
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("usn", (values.studentUsn ?? "").toUpperCase())
      .maybeSingle();

    if (!student) {
      return {
        status: "error",
        message: "No student found with that USN.",
        fieldErrors: { studentUsn: "Check the USN and try again." },
      };
    }
    studentId = student.id;
  }

  const { error } = await supabase.from("faculty_student_assignments").insert({
    faculty_id: values.facultyId,
    department_code:
      values.scopeType === "scope" ? values.departmentCode || null : null,
    semester:
      values.scopeType === "scope" && values.semester
        ? Number(values.semester)
        : null,
    section:
      values.scopeType === "scope" && values.section
        ? values.section.toUpperCase()
        : null,
    student_id: studentId,
    is_mentor: values.isMentor,
  });

  if (error) {
    return { status: "error", message: "Could not create that assignment." };
  }

  await writeAudit(
    await currentUserId(),
    "assignment.create",
    "faculty_student_assignments",
    values.facultyId,
    {
      scopeType: values.scopeType,
      departmentCode: values.departmentCode ?? null,
      semester: values.semester ?? null,
      section: values.section ?? null,
      studentUsn: values.studentUsn ?? null,
      isMentor: values.isMentor,
    },
  );

  revalidatePath("/admin/assignments");
  return { status: "success", message: "Assignment created." };
}

export async function deleteAssignment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Unknown assignment." };

  const supabase = createClient();
  const { error } = await supabase
    .from("faculty_student_assignments")
    .delete()
    .eq("id", id);

  if (error) {
    return { status: "error", message: "Could not remove that assignment." };
  }

  await writeAudit(
    await currentUserId(),
    "assignment.delete",
    "faculty_student_assignments",
    id,
  );

  revalidatePath("/admin/assignments");
  return { status: "success", message: "Assignment removed." };
}
