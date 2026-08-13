"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnStudent } from "@/lib/queries/student";
import { getOwnFaculty } from "@/lib/queries/faculty";
import { getOwnAdmin } from "@/lib/queries/admin";
import {
  achievementSchema,
  safeFileName,
  validateEvidenceFile,
  verificationSchema,
} from "@/lib/validation/achievement";
import { fieldErrorsFrom, type ActionState } from "./form-state";

const BUCKET = "achievement-evidence";

/**
 * Achievement mutations (PRD 5.4).
 *
 * Same invariant as every other mutation in this codebase: the owning
 * `student_id` is re-derived from the caller's session, never read from the
 * form. Verification is additionally pinned by database triggers, so even a
 * bug here cannot let a student mark their own achievement verified.
 */

function parseForm(formData: FormData) {
  return achievementSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    level: formData.get("level"),
    organisation: formData.get("organisation") ?? undefined,
    achievedOn: formData.get("achievedOn"),
  });
}

/**
 * Uploads evidence and records it.
 *
 * The storage path is `<student_id>/<achievement_id>/<safe-name>`, which is
 * what the storage RLS policies parse to decide access — so the filename is
 * sanitised first. A name containing a slash would otherwise appear to live
 * in a different student's folder.
 */
async function attachEvidence(
  studentId: string,
  achievementId: string,
  file: File,
): Promise<string | null> {
  const problem = validateEvidenceFile(file);
  if (problem) return problem;

  const supabase = createClient();
  const path = `${studentId}/${achievementId}/${Date.now()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return "Could not upload that file. Try again, or save without evidence.";
  }

  const { error: rowError } = await supabase
    .from("achievement_documents")
    .insert({
      achievement_id: achievementId,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
    });

  if (rowError) {
    // Roll the object back rather than leaving an orphan in the bucket that
    // nothing references and nobody can find.
    await supabase.storage.from(BUCKET).remove([path]);
    return "Could not record that file. Try again.";
  }

  return null;
}

export async function createAchievement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = createClient();
  const { data: created, error } = await supabase
    .from("achievements")
    .insert({
      student_id: student.id,
      category: parsed.data.category,
      title: parsed.data.title,
      description: parsed.data.description,
      level: parsed.data.level,
      organisation: parsed.data.organisation,
      achieved_on: parsed.data.achievedOn,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { status: "error", message: "Could not save that achievement." };
  }

  const file = formData.get("evidence");
  let evidenceNote = "";
  if (file instanceof File && file.size > 0) {
    const problem = await attachEvidence(student.id, created.id, file);
    // The achievement itself saved; the upload is reported separately rather
    // than discarding work the student already entered.
    if (problem) evidenceNote = ` The achievement was saved, but: ${problem}`;
  }

  revalidatePath("/achievements");
  revalidatePath("/dashboard");

  return {
    status: evidenceNote ? "error" : "success",
    message: evidenceNote
      ? evidenceNote.trim()
      : "Achievement added. Your mentor will review it.",
  };
}

export async function updateAchievement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const id = String(formData.get("achievementId") ?? "");
  if (!id) return { status: "error", message: "Unknown achievement." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("achievements")
    .update({
      category: parsed.data.category,
      title: parsed.data.title,
      description: parsed.data.description,
      level: parsed.data.level,
      organisation: parsed.data.organisation,
      achieved_on: parsed.data.achievedOn,
    })
    .eq("id", id)
    .eq("student_id", student.id);

  if (error) {
    return { status: "error", message: "Could not update that achievement." };
  }

  const file = formData.get("evidence");
  if (file instanceof File && file.size > 0) {
    const problem = await attachEvidence(student.id, id, file);
    if (problem) {
      revalidatePath("/achievements");
      return { status: "error", message: `Details saved, but: ${problem}` };
    }
  }

  revalidatePath("/achievements");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message:
      "Achievement updated. Editing a reviewed achievement sends it back for verification.",
  };
}

export async function deleteAchievement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const id = String(formData.get("achievementId") ?? "");
  if (!id) return { status: "error", message: "Unknown achievement." };

  const supabase = createClient();

  // Remove the stored objects first. The rows cascade with the achievement,
  // but the bucket does not — deleting the row first would strand the files
  // with nothing left pointing at them.
  const { data: docs } = await supabase
    .from("achievement_documents")
    .select("storage_path")
    .eq("achievement_id", id);

  if (docs && docs.length > 0) {
    await supabase.storage.from(BUCKET).remove(docs.map((d) => d.storage_path));
  }

  const { error } = await supabase
    .from("achievements")
    .delete()
    .eq("id", id)
    .eq("student_id", student.id);

  if (error) {
    return { status: "error", message: "Could not delete that achievement." };
  }

  revalidatePath("/achievements");
  revalidatePath("/dashboard");

  return { status: "success", message: "Achievement deleted." };
}

/**
 * Faculty or admin verdict on a submitted achievement.
 *
 * `verified_by` is resolved from the caller's own faculty row, never taken
 * from the form, so the record of who approved what cannot be forged. An
 * admin who is not also faculty records a decision with no faculty id — the
 * audit trail still shows the change through `verified_at`.
 */
export async function verifyAchievement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const [faculty, admin] = await Promise.all([getOwnFaculty(), getOwnAdmin()]);
  if (!faculty && !admin) {
    return { status: "error", message: "Only a mentor or administrator can verify." };
  }

  const parsed = verificationSchema.safeParse({
    achievementId: formData.get("achievementId"),
    decision: formData.get("decision"),
    remarks: formData.get("remarks") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  if (parsed.data.decision === "rejected" && !parsed.data.remarks) {
    return {
      status: "error",
      message: "Add a remark explaining why, so the student knows what to fix.",
      fieldErrors: { remarks: "Required when rejecting." },
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("achievements")
    .update({
      verification_status: parsed.data.decision,
      verified_by: faculty?.id ?? null,
      verified_at: new Date().toISOString(),
      remarks: parsed.data.remarks,
    })
    .eq("id", parsed.data.achievementId);

  if (error) {
    return { status: "error", message: "Could not record that decision." };
  }

  revalidatePath("/faculty/achievements");
  revalidatePath("/faculty/students");

  return {
    status: "success",
    message:
      parsed.data.decision === "verified"
        ? "Achievement verified."
        : "Achievement rejected. The student can see your remarks.",
  };
}
