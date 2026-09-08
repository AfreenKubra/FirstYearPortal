"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnStudent } from "@/lib/queries/student";
import {
  externalScoreSchema,
  externalVerdictSchema,
} from "@/lib/validation/external-score";
import { getOwnStaff } from "@/lib/queries/faculty";
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
    scoreValue: formData.get("scoreValue") ?? undefined,
    maxScore: formData.get("maxScore") ?? undefined,
    takenOn: formData.get("takenOn") ?? undefined,
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
    score_value: parsed.data.scoreValue,
    max_score: parsed.data.maxScore,
    taken_on: parsed.data.takenOn,
    // `verification_status` is not set here. It defaults to 'self_reported'
    // and the trigger in 0040 pins it there for a student regardless, so a
    // result cannot arrive already claiming to have been checked.
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

/**
 * A mentor's verdict on a student's self-reported result.
 *
 * The student's own claim — platform, test name, score, certificate — is not
 * touched. Only the verdict fields are written, which is the whole difference
 * between reviewing a claim and editing it. RLS restricts the row to students
 * this staff member can see, and 0040's trigger rejects the write outright if
 * the caller turns out not to be a reviewer.
 */
export async function setExternalScoreVerdict(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await getOwnStaff();
  if (!staff) {
    return { status: "error", message: "Teaching staff access required." };
  }

  const parsed = externalVerdictSchema.safeParse({
    scoreId: formData.get("scoreId"),
    verification: formData.get("verification"),
    reviewerNote: formData.get("reviewerNote") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("external_test_scores")
    .update({
      verification_status: parsed.data.verification,
      reviewer_note: parsed.data.reviewerNote,
      verified_by: staff.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.scoreId);

  if (error) {
    return { status: "error", message: "Could not record that decision." };
  }

  revalidatePath("/faculty/students");
  revalidatePath("/assessments");

  return {
    status: "success",
    message:
      parsed.data.verification === "verified"
        ? "Result verified."
        : parsed.data.verification === "rejected"
          ? "Result not accepted."
          : "Result returned to unverified.",
  };
}
