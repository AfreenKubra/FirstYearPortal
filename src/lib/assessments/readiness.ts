/**
 * Everything the assessment dashboard displays as a number.
 *
 * Pure and database-free for the same reason `grading.ts` is: these figures
 * are shown to a student as a statement about themselves, and shown to a
 * mentor as evidence. Arithmetic that carries that weight is unit-tested
 * without a database anywhere near it.
 *
 * The rule the whole module is built around: **a figure is reported only when
 * there are real marked attempts behind it.** Not one of these functions
 * substitutes a zero for missing data. A student who has sat nothing has an
 * overall readiness of `null` — rendered as "Not attempted yet" — because 0%
 * is a score, and telling someone they scored zero on a test they never took
 * is simply false. That distinction is the reason `null` appears in almost
 * every return type here rather than a convenient default.
 */

import {
  PERFORMANCE_LEVELS,
  SKILL_CATEGORIES,
  SCORED_CATEGORY_IDS,
  UNSCORED_CATEGORY_ID,
  type PerformanceLevel,
  type SkillCategoryId,
} from "@/config/assessments";

/** One marked attempt, reduced to what the dashboard actually needs. */
export type ScoredAttempt = {
  attemptNumber: number;
  /** null while a human still has to mark part of the paper. */
  percentage: number | null;
  submittedAt: string | null;
  correct: number | null;
  wrong: number | null;
  timeTakenSeconds: number | null;
};

export type CategoryAttempts = {
  categoryId: SkillCategoryId;
  attempts: ScoredAttempt[];
};

/**
 * The band a percentage falls in.
 *
 * Clamped rather than returning null out of range: a percentage outside
 * 0-100 is a bug upstream, and the honest response on screen is the nearest
 * real band, not a crash on a results page.
 */
export function performanceLevel(percentage: number): PerformanceLevel {
  const clamped = Math.max(0, Math.min(100, percentage));
  for (const level of PERFORMANCE_LEVELS) {
    if (clamped >= level.min && clamped <= level.max) return level;
  }
  // Unreachable: the bands cover 0-100 with no gaps, and a test holds them to
  // it. Returning the top band rather than throwing, because a results page
  // failing to render is worse than a mislabelled band.
  return PERFORMANCE_LEVELS[PERFORMANCE_LEVELS.length - 1];
}

export type CategorySummary = {
  categoryId: SkillCategoryId;
  label: string;
  covers: string;
  /** False for the personality questionnaire, which has no right answers. */
  scored: boolean;
  attemptCount: number;
  /** Most recent marked percentage, or null when nothing is marked. */
  latestPercentage: number | null;
  /** Highest marked percentage across every attempt. */
  bestPercentage: number | null;
  /** ISO timestamp of the most recent submission, or null. */
  lastAttemptAt: string | null;
  level: PerformanceLevel | null;
  /** Percentage points between the first and latest marked attempt. */
  improvement: number | null;
};

function markedPercentages(attempts: readonly ScoredAttempt[]): number[] {
  return attempts
    .filter((a) => a.percentage !== null)
    .sort((a, b) => a.attemptNumber - b.attemptNumber)
    .map((a) => a.percentage as number);
}

export function summariseCategory(
  categoryId: SkillCategoryId,
  attempts: readonly ScoredAttempt[],
): CategorySummary {
  const category = SKILL_CATEGORIES.find((c) => c.id === categoryId);
  const scored = categoryId !== UNSCORED_CATEGORY_ID;
  const marked = markedPercentages(attempts);

  const latest = marked.length > 0 ? marked[marked.length - 1] : null;
  const best = marked.length > 0 ? Math.max(...marked) : null;

  // Improvement needs two marked attempts to be a difference at all. With
  // one, there is nothing to have improved from, and 0 would read as "no
  // progress" rather than "not yet comparable".
  const improvement =
    marked.length >= 2
      ? Math.round((marked[marked.length - 1] - marked[0]) * 100) / 100
      : null;

  const lastAttemptAt = attempts
    .map((a) => a.submittedAt)
    .filter((t): t is string => t !== null)
    .sort()
    .pop() ?? null;

  return {
    categoryId,
    label: category?.label ?? categoryId,
    covers: category?.covers ?? "",
    scored,
    attemptCount: attempts.length,
    latestPercentage: scored ? latest : null,
    bestPercentage: scored ? best : null,
    lastAttemptAt,
    level: scored && latest !== null ? performanceLevel(latest) : null,
    improvement: scored ? improvement : null,
  };
}

export type Readiness = {
  summaries: CategorySummary[];
  /**
   * The mean of the latest marked percentage in each scored area that has
   * one. Null until at least one exists.
   *
   * Deliberately averaged over *areas attempted*, not over all five. Dividing
   * by five would drag the figure down in proportion to how much a student
   * has not yet done, and present that as poor performance.
   */
  overallPercentage: number | null;
  overallLevel: PerformanceLevel | null;
  /** How many of the six areas have at least one attempt. */
  completedCount: number;
  totalCategories: number;
  totalAttempts: number;
  strongest: CategorySummary | null;
  needsImprovement: CategorySummary | null;
  /** The scored area with the largest gain between first and latest attempt. */
  mostImproved: CategorySummary | null;
};

export function buildReadiness(
  byCategory: readonly CategoryAttempts[],
): Readiness {
  const lookup = new Map(byCategory.map((c) => [c.categoryId, c.attempts]));

  const summaries = SKILL_CATEGORIES.map((category) =>
    summariseCategory(category.id, lookup.get(category.id) ?? []),
  );

  const scoredWithResults = summaries.filter(
    (s) => s.scored && s.latestPercentage !== null,
  );

  const overallPercentage =
    scoredWithResults.length === 0
      ? null
      : Math.round(
          (scoredWithResults.reduce((sum, s) => sum + (s.latestPercentage ?? 0), 0) /
            scoredWithResults.length) *
            100,
        ) / 100;

  // Strongest and weakest are only meaningful once there is something to
  // compare. Naming the single area a student has attempted as both their
  // "strongest" and their "needs improvement" would be true and absurd.
  const ranked = [...scoredWithResults].sort(
    (a, b) => (b.latestPercentage ?? 0) - (a.latestPercentage ?? 0),
  );

  const improved = summaries
    .filter((s) => s.improvement !== null && s.improvement > 0)
    .sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0));

  return {
    summaries,
    overallPercentage,
    overallLevel:
      overallPercentage === null ? null : performanceLevel(overallPercentage),
    completedCount: summaries.filter((s) => s.attemptCount > 0).length,
    totalCategories: summaries.length,
    totalAttempts: summaries.reduce((sum, s) => sum + s.attemptCount, 0),
    strongest: ranked.length >= 2 ? ranked[0] : null,
    needsImprovement: ranked.length >= 2 ? ranked[ranked.length - 1] : null,
    mostImproved: improved.length > 0 ? improved[0] : null,
  };
}

/** One axis of the skill radar. Personality is never among them. */
export type SkillAxis = { label: string; value: number; attempted: boolean };

/**
 * The five scored areas as radar axes.
 *
 * An area with no marked attempt plots at 0 — but carries `attempted: false`
 * so the table beneath the chart can say "Not attempted yet" rather than
 * "0%". The shape needs a point for every axis or it stops being a pentagon;
 * the words next to it are what stop the 0 being read as a score.
 */
export function buildSkillAxes(summaries: readonly CategorySummary[]): SkillAxis[] {
  return SCORED_CATEGORY_IDS.map((id) => {
    const summary = summaries.find((s) => s.categoryId === id);
    const value = summary?.latestPercentage ?? null;
    return {
      label: summary?.label ?? id,
      value: value ?? 0,
      attempted: value !== null,
    };
  });
}

export type Insight = { heading: string; detail: string };

/**
 * The plain-language read of the numbers above.
 *
 * Deterministic string assembly from figures already computed — no model
 * call, no paid API, and nothing said here that the summaries do not already
 * establish. Each insight is omitted entirely rather than hedged when its
 * precondition is missing, which is why this returns a short list on a new
 * account instead of five sentences of "not enough data".
 */
export function buildInsights(readiness: Readiness): Insight[] {
  const insights: Insight[] = [];

  if (readiness.strongest?.latestPercentage != null) {
    insights.push({
      heading: "Strongest area",
      detail: `${readiness.strongest.label} — ${readiness.strongest.latestPercentage}%`,
    });
  }

  if (readiness.needsImprovement?.latestPercentage != null) {
    insights.push({
      heading: "Needs attention",
      detail: `${readiness.needsImprovement.label} — ${readiness.needsImprovement.latestPercentage}%`,
    });
  }

  if (readiness.mostImproved?.improvement != null) {
    insights.push({
      heading: "Largest improvement",
      detail: `${readiness.mostImproved.label} — up ${readiness.mostImproved.improvement} percentage points since your first attempt`,
    });
  }

  // The recommendation is the weakest attempted area, or the first area not
  // attempted at all. Never both, and never a generic "keep practising".
  const notAttempted = readiness.summaries.find((s) => s.attemptCount === 0);
  if (notAttempted) {
    insights.push({
      heading: "Recommended next step",
      detail: `Take the ${notAttempted.label} assessment — you have not attempted it yet.`,
    });
  } else if (readiness.needsImprovement) {
    insights.push({
      heading: "Recommended next step",
      detail: `Retake the ${readiness.needsImprovement.label} assessment.`,
    });
  }

  return insights;
}

/**
 * Attempts in order, for the progress line graph.
 *
 * Unmarked attempts are dropped rather than plotted at zero: a line that dips
 * to the floor because nobody has marked the paper yet reads as a collapse in
 * performance.
 */
export type TrendPoint = { attemptNumber: number; percentage: number };

export function buildTrend(attempts: readonly ScoredAttempt[]): TrendPoint[] {
  return attempts
    .filter((a): a is ScoredAttempt & { percentage: number } => a.percentage !== null)
    .sort((a, b) => a.attemptNumber - b.attemptNumber)
    .map((a) => ({ attemptNumber: a.attemptNumber, percentage: a.percentage }));
}

/** "Improved by 17 percentage points", or null when there is no comparison. */
export function improvementLabel(trend: readonly TrendPoint[]): string | null {
  if (trend.length < 2) return null;
  const delta =
    Math.round((trend[trend.length - 1].percentage - trend[0].percentage) * 100) / 100;
  if (delta === 0) return "No change since your first attempt";
  const direction = delta > 0 ? "Improved by" : "Down by";
  return `${direction} ${Math.abs(delta)} percentage points since your first attempt`;
}

/** A result a student recorded from a platform outside this portal. */
export type ExternalResult = {
  id: string;
  categoryId: SkillCategoryId | null;
  platform: string;
  testName: string;
  /** Exactly what the student typed: "82%", "Elite", "Band 7". */
  scoreLabel: string;
  scoreValue: number | null;
  maxScore: number | null;
  takenOn: string | null;
  verification: "self_reported" | "verified" | "rejected";
  /** A reviewer's reason, shown to the student alongside the verdict. */
  reviewerNote: string | null;
};

/**
 * An external result as a percentage, or null when it is not one.
 *
 * "Elite", "Pass" and "Band 7" are real results that are not positions on a
 * 0-100 scale, and this returns null for them rather than inventing a number.
 * A rejected result also returns null: a member of staff has looked at it and
 * declined it, so it is not evidence of anything and must not be plotted.
 */
export function externalPercentage(result: ExternalResult): number | null {
  if (result.verification === "rejected") return null;
  if (result.scoreValue === null || result.maxScore === null) return null;
  if (result.maxScore <= 0) return null;
  return Math.round((result.scoreValue / result.maxScore) * 10000) / 100;
}

export type ExternalCategorySummary = {
  /** Everything the student recorded against this area, newest first. */
  results: ExternalResult[];
  /** Best percentage among results a member of staff has verified. */
  bestVerifiedPercentage: number | null;
  /** Best percentage among results nobody has checked yet. */
  bestUnverifiedPercentage: number | null;
  awaitingReview: number;
};

/**
 * External results for one skill area, split by whether anyone has checked
 * them.
 *
 * The split is the whole point. A verified result and a number a student
 * typed in last night are shown differently and counted differently, and
 * keeping them apart here means no UI can accidentally present one as the
 * other.
 */
export function summariseExternal(
  results: readonly ExternalResult[],
  categoryId: SkillCategoryId,
): ExternalCategorySummary {
  const mine = results
    .filter((r) => r.categoryId === categoryId)
    .sort((a, b) => (b.takenOn ?? "").localeCompare(a.takenOn ?? ""));

  const best = (verification: ExternalResult["verification"]) => {
    const percentages = mine
      .filter((r) => r.verification === verification)
      .map(externalPercentage)
      .filter((p): p is number => p !== null);
    return percentages.length > 0 ? Math.max(...percentages) : null;
  };

  return {
    results: mine,
    bestVerifiedPercentage: best("verified"),
    bestUnverifiedPercentage: best("self_reported"),
    awaitingReview: mine.filter((r) => r.verification === "self_reported").length,
  };
}

/**
 * Which attempt statuses have a result worth reporting.
 *
 * An attempt still open is not a result — counting it would add to a
 * student's attempt total the moment they opened the paper, before they
 * answered anything. An abandoned one is not a result either. Both are real
 * rows that simply have nothing to say about performance yet.
 *
 * This is the rule that decides whether a score reaches its skill card at
 * all, so it lives here where it can be tested rather than inline in a query.
 */
export const REPORTABLE_ATTEMPT_STATUSES = ["submitted", "graded"] as const;

export function isReportableAttempt(status: string): boolean {
  return (REPORTABLE_ATTEMPT_STATUSES as readonly string[]).includes(status);
}

/** A raw attempt row, in the shape the query layer returns. */
export type RawAttempt = {
  attemptNumber: number;
  status: string;
  percentage: number | null;
  submittedAt: string | null;
  correctCount: number | null;
  wrongCount: number | null;
  timeTakenSeconds: number | null;
};

/**
 * Attempt rows reduced to what the dashboard reports.
 *
 * Marking state is preserved rather than flattened: an attempt that has been
 * submitted but not yet marked keeps `percentage: null`, so it counts towards
 * the attempt total and appears in the history as "Awaiting marking" without
 * ever being drawn as a score.
 */
export function toScoredAttempts(
  attempts: readonly RawAttempt[],
): ScoredAttempt[] {
  return attempts.filter((a) => isReportableAttempt(a.status)).map((a) => ({
    attemptNumber: a.attemptNumber,
    percentage: a.percentage,
    submittedAt: a.submittedAt,
    correct: a.correctCount,
    wrong: a.wrongCount,
    timeTakenSeconds: a.timeTakenSeconds,
  }));
}
