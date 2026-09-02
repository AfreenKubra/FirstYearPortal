"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listMarkComponents } from "@/lib/queries/marks";
import { validateMark } from "@/lib/marks/compute";
import type { ActionState } from "./form-state";

/**
 * Internal marks mutations (migration 0025).
 *
 * Every action re-derives the caller from their session and refuses a
 * non-staff caller before touching the database — ARCHITECTURE section 3's
 * layer 2. RLS would refuse the write anyway, but a zero-row update is
 * indistinguishable from a successful one from the client's side, so failing
 * here is what turns a silent no-op into a message.
 *
 * There is no subject-teacher table yet (a deliberate scope decision, see
 * MANUAL-STEPS), so any member of staff who can see a student may edit their
 * marks. `entered_by` and the audit entries below are the whole of the
 * accountability story until that changes.
 */

/**
 * Mirrors `actions/admin.ts`. Kept local rather than shared for now because
 * the two write different entity types and the shared version would be a
 * parameter bag with one caller each; if a third appears, extract it.
 */
async function writeAudit(
  actorUserId: string | null,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const service = createAdminClient();
    await service.from("audit_logs").insert({
      actor_user_id: actorUserId,
      action,
      entity_type: "student_subject_marks",
      entity_id: entityId,
      metadata,
    });
  } catch {
    // An audit failure must not fail the save the faculty member asked for.
    // The gap is visible in the log, which is the lesser harm.
  }
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Cell names are `mark:<studentId>:<componentCode>`. */
const CELL_PREFIX = "mark:";

type ParsedCell = {
  studentId: string;
  componentCode: string;
  raw: string;
};

function parseCells(formData: FormData): ParsedCell[] {
  const cells: ParsedCell[] = [];

  for (const [name, value] of formData.entries()) {
    if (!name.startsWith(CELL_PREFIX)) continue;
    const [, studentId, componentCode] = name.split(":");
    if (!studentId || !componentCode) continue;
    cells.push({ studentId, componentCode, raw: String(value) });
  }

  return cells;
}

/**
 * Saves the whole grid in one submission.
 *
 * A row exists if and only if a mark is recorded: clearing a cell deletes its
 * row rather than storing a null. That keeps "not marked" as the absence of a
 * row instead of two states meaning the same thing, and it means releasing a
 * component releases exactly the marks that exist.
 */
export async function saveMarks(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await getOwnStaff();
  if (!staff) {
    return { status: "error", message: "Staff access required." };
  }

  const subjectId = String(formData.get("subjectId") ?? "");
  if (!subjectId) return { status: "error", message: "Unknown subject." };

  const components = await listMarkComponents();
  const byCode = new Map(components.map((c) => [c.code, c]));

  const cells = parseCells(formData);
  if (cells.length === 0) {
    return { status: "error", message: "Nothing to save." };
  }

  const toUpsert: Array<{
    student_id: string;
    subject_id: string;
    component_code: string;
    marks: number;
    max_marks: number;
  }> = [];
  const toClear: ParsedCell[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const cell of cells) {
    const component = byCode.get(cell.componentCode);
    if (!component) continue;

    const result = validateMark(cell.raw, component.maxMarks);
    if (!result.ok) {
      fieldErrors[`${CELL_PREFIX}${cell.studentId}:${cell.componentCode}`] =
        result.error;
      continue;
    }

    if (result.value === null) {
      toClear.push(cell);
    } else {
      toUpsert.push({
        student_id: cell.studentId,
        subject_id: subjectId,
        component_code: cell.componentCode,
        marks: result.value,
        // Snapshotted deliberately — see migration 0025.
        max_marks: component.maxMarks,
      });
    }
  }

  // Refuse the whole submission rather than saving the valid half. A grid
  // that saved 58 of 60 students and reported an error would leave the
  // faculty member with no way to tell which two did not land.
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Some marks are out of range. Nothing was saved.",
      fieldErrors,
    };
  }

  const supabase = createClient();

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("student_subject_marks")
      .upsert(toUpsert, {
        onConflict: "student_id,subject_id,component_code",
      });

    if (error) {
      return {
        status: "error",
        message:
          "Could not save these marks. You may not have access to some of these students.",
      };
    }
  }

  // Cleared cells, one query per component rather than one per student.
  for (const component of components) {
    const studentIds = toClear
      .filter((c) => c.componentCode === component.code)
      .map((c) => c.studentId);
    if (studentIds.length === 0) continue;

    await supabase
      .from("student_subject_marks")
      .delete()
      .eq("subject_id", subjectId)
      .eq("component_code", component.code)
      .in("student_id", studentIds);
  }

  await writeAudit(await currentUserId(), "marks.save", subjectId, {
    faculty_id: staff.id,
    recorded: toUpsert.length,
    cleared: toClear.length,
  });

  revalidatePath("/faculty/marks");
  revalidatePath("/hod/marks");

  return {
    status: "success",
    message: `Saved. ${toUpsert.length} recorded${
      toClear.length > 0 ? `, ${toClear.length} cleared` : ""
    }. Students see a component only once it is released.`,
  };
}

/**
 * Releases one component of one subject to the students it belongs to.
 *
 * Per component rather than per student: a class is marked together, and
 * releasing row by row would show the students marked first a column in which
 * everyone else appears blank.
 */
export async function releaseComponent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await getOwnStaff();
  if (!staff) {
    return { status: "error", message: "Staff access required." };
  }

  const subjectId = String(formData.get("subjectId") ?? "");
  const componentCode = String(formData.get("componentCode") ?? "");
  const withdraw = formData.get("withdraw") === "true";

  if (!subjectId || !componentCode) {
    return { status: "error", message: "Unknown subject or component." };
  }

  const supabase = createClient();

  // RLS narrows this to students the caller may write, so a mentor releasing
  // a component releases it for their own students only — the update simply
  // does not reach the rest.
  const { error } = await supabase
    .from("student_subject_marks")
    .update({ published_at: withdraw ? null : new Date().toISOString() })
    .eq("subject_id", subjectId)
    .eq("component_code", componentCode);

  if (error) {
    return { status: "error", message: "Could not change that component." };
  }

  await writeAudit(
    await currentUserId(),
    withdraw ? "marks.withdraw" : "marks.release",
    subjectId,
    { faculty_id: staff.id, component_code: componentCode },
  );

  revalidatePath("/faculty/marks");
  revalidatePath("/hod/marks");
  revalidatePath("/assessments");

  return {
    status: "success",
    message: withdraw
      ? "Withdrawn. Students can no longer see that component."
      : "Released. Students can now see that component.",
  };
}
