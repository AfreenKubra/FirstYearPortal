import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SkillCategoryId } from "@/config/assessments";

/**
 * Self-reported external test scores, and the one real number this portal can
 * compute about assessments it actually graded.
 *
 * `listOwnExternalScores` reads exactly what the student typed — RLS already
 * restricts this to their own rows, the same as `getOwnAttempts`. Nothing
 * here verifies, scores, or ranks a self-reported row; that is the entire
 * point of the table it reads from.
 */

export type ExternalScore = {
  id: string;
  platform: string;
  testName: string;
  scoreLabel: string;
  certificateUrl: string | null;
  category: SkillCategoryId | null;
  createdAt: string;
};

const COLUMNS =
  "id, platform, test_name, score_label, certificate_url, category, created_at" as const;

export async function listOwnExternalScores(): Promise<ExternalScore[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("external_test_scores")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    testName: row.test_name,
    scoreLabel: row.score_label,
    certificateUrl: row.certificate_url,
    category: row.category as SkillCategoryId | null,
    createdAt: row.created_at,
  }));
}

export type AssessmentAverage = {
  attemptCount: number;
  averagePercentage: number | null;
};

/**
 * Average percentage across the caller's own graded attempts, optionally
 * narrowed to one assessment kind.
 *
 * Ungraded attempts (`percentage is null`) are excluded from the average
 * rather than counted as 0 — an assessment nobody has marked yet is not
 * evidence of a low score, it is an absence of evidence.
 */
export async function getOwnAssessmentAverage(
  kind?: "general" | "english" | "psychometric",
): Promise<AssessmentAverage> {
  const supabase = createClient();

  const { data } = await supabase
    .from("assessment_attempts")
    .select("percentage, assessment_id")
    .not("percentage", "is", null);

  let rows = data ?? [];

  // Narrowed in a second query rather than an embedded-resource filter, the
  // same two-step join every other query in this codebase uses (e.g.
  // `getAttemptsForAssessment` joining students) rather than leaning on
  // PostgREST's embedded-filter syntax for the one place that would use it.
  if (kind && rows.length > 0) {
    const { data: assessments } = await supabase
      .from("assessments")
      .select("id")
      .eq("kind", kind)
      .in(
        "id",
        Array.from(new Set(rows.map((r) => r.assessment_id))),
      );
    const matching = new Set((assessments ?? []).map((a) => a.id));
    rows = rows.filter((r) => matching.has(r.assessment_id));
  }

  if (rows.length === 0) return { attemptCount: 0, averagePercentage: null };

  const total = rows.reduce((sum, row) => sum + Number(row.percentage ?? 0), 0);
  return {
    attemptCount: rows.length,
    averagePercentage: Math.round((total / rows.length) * 100) / 100,
  };
}
