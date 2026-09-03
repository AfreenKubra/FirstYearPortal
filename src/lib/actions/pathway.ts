"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnStudent } from "@/lib/queries/student";
import { type ActionState } from "./form-state";

/**
 * Career pathway mutations: which goal/domain is primary, and which pathway
 * items are checked off. `student_id` is always re-derived from the
 * caller's session, the standing rule every mutation in this codebase
 * follows.
 *
 * Setting a primary is two sequential statements rather than one — clear the
 * existing primary, then set the new one — so the partial unique index in
 * migration 0027 (`unique (student_id) where is_primary`) is never violated
 * even momentarily: the old row is false before the new one becomes true.
 */

export async function setPrimaryGoal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const goalId = Number(formData.get("goalId"));
  if (!Number.isInteger(goalId)) {
    return { status: "error", message: "Choose a career goal." };
  }

  const supabase = createClient();
  await supabase
    .from("student_goals")
    .update({ is_primary: false })
    .eq("student_id", student.id)
    .eq("is_primary", true);

  // Upsert, not update: a student may pick a goal from the full list that
  // isn't on their profile yet, which adds it as well as making it primary.
  // Nothing is removed — the profile page stays the place to deselect.
  const { error } = await supabase
    .from("student_goals")
    .upsert(
      { student_id: student.id, goal_id: goalId, is_primary: true },
      { onConflict: "student_id,goal_id" },
    );

  if (error) {
    return { status: "error", message: "Could not set that as your primary goal." };
  }

  // Adding a goal moves the profile fingerprint, so the roadmap below the
  // pathway rebuilds itself on the next view — and the dashboard's profile
  // card shows the new tag.
  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
  return { status: "success", message: "Primary career goal updated." };
}

export async function setPrimaryDomain(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const domainId = Number(formData.get("domainId"));
  if (!Number.isInteger(domainId)) {
    return { status: "error", message: "Choose a technical domain." };
  }

  const supabase = createClient();
  await supabase
    .from("student_domains")
    .update({ is_primary: false })
    .eq("student_id", student.id)
    .eq("is_primary", true);

  // Same as goals above: picking from the full list adds the domain if it
  // wasn't already on the profile, and never removes the others.
  const { error } = await supabase
    .from("student_domains")
    .upsert(
      { student_id: student.id, domain_id: domainId, is_primary: true },
      { onConflict: "student_id,domain_id" },
    );

  if (error) {
    return { status: "error", message: "Could not set that as your primary domain." };
  }

  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
  return { status: "success", message: "Primary technical domain updated." };
}

/*
 * There is deliberately no `togglePathwayItem` here any more. Letting a
 * student tick pathway items off produced a progress percentage that nobody
 * had verified — a claim about them derived purely from their own say-so.
 * Position on the timeline now comes from their recorded semester, and what
 * they have actually done is read from records a third party confirmed
 * (see `getPathwayEvidence` in `lib/queries/pathway.ts`).
 */
