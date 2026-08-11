"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnAdmin } from "@/lib/queries/admin";
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
