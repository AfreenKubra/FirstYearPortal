"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnStudent } from "@/lib/queries/student";
import { externalScoreSchema } from "@/lib/validation/external-score";
import { fieldErrorsFrom, type ActionState } from "./form-state";

/**
 * External score mutations.
 *
 * `student_id` is always re-derived from the caller's own session, the same
 * invariant every other mutation in this codebase follows — never taken from
 * the form. There is no verification step to guard here: this table has no
 * staff write path at all (see migration 0025), so nothing downstream ever
 * needs to trust these values as fact.
 */

export async function addExternalScore(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const parsed = externalScoreSchema.safeParse({
    platform: formData.get("platform"),
    testName: formData.get("testName"),
    scoreLabel: formData.get("scoreLabel"),
    certificateUrl: formData.get("certificateUrl") ?? undefined,
    category: formData.get("category") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = createClient();
  const { error } = await supabase.from("external_test_scores").insert({
    student_id: student.id,
    platform: parsed.data.platform,
    test_name: parsed.data.testName,
    score_label: parsed.data.scoreLabel,
    certificate_url: parsed.data.certificateUrl,
    category: parsed.data.category,
  });

  if (error) {
    return { status: "error", message: "Could not save that score." };
  }

  revalidatePath("/assessments");
  revalidatePath("/roadmap");

  return { status: "success", message: "Score added." };
}

export async function deleteExternalScore(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const id = String(formData.get("scoreId") ?? "");
  if (!id) return { status: "error", message: "Unknown score." };

  const supabase = createClient();
  const { error } = await supabase
    .from("external_test_scores")
    .delete()
    .eq("id", id)
    .eq("student_id", student.id);

  if (error) {
    return { status: "error", message: "Could not delete that score." };
  }

  revalidatePath("/assessments");
  revalidatePath("/roadmap");

  return { status: "success", message: "Score deleted." };
}
