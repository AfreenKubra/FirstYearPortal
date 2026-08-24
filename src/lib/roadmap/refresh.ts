import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnStudent } from "@/lib/queries/student";
import { getSubjectsFor } from "@/lib/queries/vtu";
import { generateWithFallback } from "./provider";
import { fingerprintInputs, isStale } from "./fingerprint";
import type { RoadmapInput } from "./generate";

/**
 * Keeping a student's roadmap current (PRD 5.10).
 *
 * Regeneration happens lazily, when the student opens their roadmap, rather
 * than from a database trigger or a background job. Three reasons:
 *
 *   - The generator is TypeScript. Running it from a Postgres trigger would
 *     mean reimplementing it in PL/pgSQL and keeping two copies in step.
 *   - A student who edits their profile five times in a minute gets one
 *     regeneration, at the point it is actually looked at, not five.
 *   - There is nothing to go stale in the background and no queue to drain.
 *
 * The cost is that the first page view after a profile change does the work.
 * For a plan of this size that is a few milliseconds of pure computation plus
 * one write.
 */

/**
 * Gathers what the generator is allowed to see.
 *
 * Deliberately narrow — guardian contact, phone, address, and date of birth
 * are all readable at this point and none of them belong in a development
 * plan (ARCHITECTURE 6.3).
 */
async function collectInput(
  studentId: string,
  departmentCode: string,
): Promise<RoadmapInput | null> {
  const supabase = createClient();

  const { data: student } = await supabase
    .from("student_directory")
    .select("semester, tenth_percentage, twelfth_percentage")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) return null;

  const [goals, domains, interests, department, achievements] = await Promise.all([
    supabase.from("student_goals").select("goal_id").eq("student_id", studentId),
    supabase.from("student_domains").select("domain_id").eq("student_id", studentId),
    supabase.from("student_interests").select("interest_id").eq("student_id", studentId),
    supabase.from("departments").select("name").eq("code", departmentCode).maybeSingle(),
    supabase
      .from("achievements")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("verification_status", "verified"),
  ]);

  const [goalNames, domainNames, interestNames, subjects] = await Promise.all([
    supabase.from("career_goals").select("id, name"),
    supabase.from("technical_domains").select("id, name"),
    supabase.from("interests").select("id, name"),
    getSubjectsFor(departmentCode, student.semester),
  ]);

  const resolve = (
    options: Array<{ id: number; name: string }> | null,
    ids: number[],
  ) => {
    const map = new Map((options ?? []).map((o) => [o.id, o.name]));
    return ids.map((id) => map.get(id)).filter(Boolean) as string[];
  };

  return {
    departmentName: department.data?.name ?? departmentCode,
    semester: student.semester,
    goals: resolve(goalNames.data, (goals.data ?? []).map((r) => r.goal_id)),
    domains: resolve(domainNames.data, (domains.data ?? []).map((r) => r.domain_id)),
    interests: resolve(interestNames.data, (interests.data ?? []).map((r) => r.interest_id)),
    tenthPercentage: student.tenth_percentage,
    twelfthPercentage: student.twelfth_percentage,
    verifiedAchievements: achievements.count ?? 0,
    vtuSubjects: subjects.map((s) => `${s.name} (${s.code})`),
    vtuSchemeUrl: subjects[0]?.officialUrl ?? null,
  };
}

export type RefreshOutcome =
  | { changed: false; reason: "current" | "no_student" }
  | { changed: true; roadmapId: string; milestones: number };

/**
 * Regenerates the signed-in student's roadmap if their profile has moved on.
 *
 * Returns without writing when the fingerprint matches, which is the common
 * case — this runs on every roadmap page view.
 */
export async function refreshOwnRoadmap(): Promise<RefreshOutcome> {
  const student = await getOwnStudent();
  if (!student) return { changed: false, reason: "no_student" };

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("student_roadmaps")
    .select("id, inputs_fingerprint, approval_status")
    .eq("student_id", student.id)
    .neq("approval_status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const input = await collectInput(student.id, student.departmentCode);
  if (!input) return { changed: false, reason: "no_student" };

  if (existing && !isStale(existing.inputs_fingerprint, input)) {
    return { changed: false, reason: "current" };
  }

  const { roadmap, generator } = await generateWithFallback(input);
  const fingerprint = fingerprintInputs(input);

  // The service role writes the plan for the same reason the assessment
  // scoring path uses it: `guard_roadmap_approval` forces a non-reviewer's
  // insert to 'draft', and a student inserting their own roadmap is not a
  // reviewer. Writing 'auto' has to come from outside that check.
  const service = createAdminClient();

  if (existing) {
    await service
      .from("student_roadmaps")
      .update({ approval_status: "superseded" })
      .eq("id", existing.id);
  }

  const { data: created, error } = await service
    .from("student_roadmaps")
    .insert({
      student_id: student.id,
      generated_by: generator.source,
      provider: generator.provider,
      model: generator.model,
      inputs_summary: roadmap.inputsSummary,
      inputs_fingerprint: fingerprint,
      approval_status: "auto",
    })
    .select("id")
    .single();

  if (error || !created) {
    // A failed regeneration must not take the page down. The student keeps
    // seeing the plan they already had, which is stale but real — and the
    // next view tries again.
    if (existing) {
      await service
        .from("student_roadmaps")
        .update({ approval_status: "auto" })
        .eq("id", existing.id);
    }
    return { changed: false, reason: "current" };
  }

  const { error: milestoneError } = await service
    .from("roadmap_milestones")
    .insert(
      roadmap.milestones.map((m, index) => ({
        roadmap_id: created.id,
        horizon: m.horizon,
        title: m.title,
        detail: m.detail,
        rationale: m.rationale,
        position: index,
      })),
    );

  if (milestoneError) {
    // A roadmap with no milestones is not a roadmap.
    await service.from("student_roadmaps").delete().eq("id", created.id);
    if (existing) {
      await service
        .from("student_roadmaps")
        .update({ approval_status: "auto" })
        .eq("id", existing.id);
    }
    return { changed: false, reason: "current" };
  }

  return {
    changed: true,
    roadmapId: created.id,
    milestones: roadmap.milestones.length,
  };
}
