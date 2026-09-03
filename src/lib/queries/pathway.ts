import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SelectionOption } from "@/lib/roadmap/pathway";

/**
 * Reads backing the career pathway timeline: which goals/domains a student
 * selected (with their `is_primary` flag), and which pathway items they've
 * checked off. `resolvePrimary()` in `lib/roadmap/pathway.ts` turns the
 * selection lists into an actual primary; this file only reads the rows.
 */

export async function getGoalSelections(studentId: string): Promise<SelectionOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("student_goals")
    .select("goal_id, is_primary, career_goals(id, name)")
    .eq("student_id", studentId);

  return (data ?? [])
    .map((row) => {
      const goal = row.career_goals as unknown as { id: number; name: string } | null;
      if (!goal) return null;
      return { id: goal.id, name: goal.name, isPrimary: row.is_primary };
    })
    .filter((o): o is SelectionOption => o !== null);
}

export async function getDomainSelections(studentId: string): Promise<SelectionOption[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("student_domains")
    .select("domain_id, is_primary, technical_domains(id, name)")
    .eq("student_id", studentId);

  return (data ?? [])
    .map((row) => {
      const domain = row.technical_domains as unknown as { id: number; name: string } | null;
      if (!domain) return null;
      return { id: domain.id, name: domain.name, isPrimary: row.is_primary };
    })
    .filter((o): o is SelectionOption => o !== null);
}

export type EvidenceEntry = {
  label: string;
  value: string;
  /** Who confirmed this — never "you said so". */
  source: string;
};

/**
 * What a student has actually done, according to records somebody other
 * than the student confirmed.
 *
 * This replaced a self-ticked checklist. Every row below traces to a
 * verification somebody else performed: a mentor verifying an achievement,
 * faculty grading an attempt, faculty entering internal marks, faculty
 * marking attendance at an event. Self-reported external scores are
 * deliberately *not* counted here — they live on `/assessments` with their
 * own "not verified" label, and folding them in would launder a claim into
 * evidence.
 *
 * A zero is shown as a zero. An empty record is a fact about the record,
 * not a reason to pad it.
 */
export async function getPathwayEvidence(studentId: string): Promise<EvidenceEntry[]> {
  const supabase = createClient();

  const [achievements, attempts, marks, registrations] = await Promise.all([
    supabase
      .from("achievements")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("verification_status", "verified"),
    supabase
      .from("assessment_attempts")
      .select("percentage")
      .eq("student_id", studentId)
      .eq("status", "graded")
      .not("percentage", "is", null),
    supabase
      .from("student_subject_marks")
      .select("subject_id, marks")
      .eq("student_id", studentId)
      .not("marks", "is", null),
    supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("attended", true),
  ]);

  const graded = (attempts.data ?? []) as Array<{ percentage: number | null }>;
  const average =
    graded.length === 0
      ? null
      : Math.round(
          (graded.reduce((sum, r) => sum + Number(r.percentage ?? 0), 0) / graded.length) * 10,
        ) / 10;

  const subjectsWithMarks = new Set(
    (marks.data ?? []).map((mark) => mark.subject_id),
  ).size;

  return [
    {
      label: "Verified achievements",
      value: String(achievements.count ?? 0),
      source: "Confirmed by your mentor",
    },
    {
      label: "Graded assessments",
      value: average === null ? "None yet" : `${graded.length} · avg ${average}%`,
      source: "Marked by faculty",
    },
    {
      label: "Subjects with released marks",
      value: String(subjectsWithMarks),
      source: "Entered by faculty",
    },
    {
      label: "Workshops attended",
      value: String(registrations.count ?? 0),
      source: "Marked present at the event",
    },
  ];
}
