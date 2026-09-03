/**
 * The five numbers behind the roadmap's radar chart.
 *
 * "Based on career goals, technical domains, and areas of interest" is not by
 * itself a number — those are selections, not scores. So this plots what can
 * honestly be computed from them (how much of what's on offer a student has
 * picked) alongside two numbers that measure actual progress rather than
 * profile completeness: how much of the roadmap is done, and how the student
 * has actually performed on assessments. Every axis is a real ratio of real
 * counts — nothing here is estimated, inferred, or defaulted to look fuller
 * than the data supports.
 *
 * Pure and free of `server-only`, like `coverage.ts`/`filters.ts` beside it —
 * the caller does every database read and hands this plain numbers.
 */

export type RadarAxis = { axis: string; value: number };

export type RadarInput = {
  goalsChosen: number;
  goalsOffered: number;
  domainsChosen: number;
  domainsOffered: number;
  interestsChosen: number;
  interestsOffered: number;
  /** 0–100, from `roadmapProgress()`. 0 when there is no roadmap yet. */
  milestonesPercent: number;
  /** 0–100 average across graded assessment attempts, or null if none exist. */
  assessmentAveragePercent: number | null;
};

/**
 * A ratio as a 0–100 percentage. A zero denominator (no goals offered at
 * all, say) renders 0, not `NaN` — the axis still needs a real number to
 * plot, and 0 is the honest answer to "chosen out of nothing offered."
 */
function ratioPercent(chosen: number, offered: number): number {
  if (offered <= 0) return 0;
  return clamp((chosen / offered) * 100);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function buildRadarData(input: RadarInput): RadarAxis[] {
  return [
    { axis: "Career goals", value: ratioPercent(input.goalsChosen, input.goalsOffered) },
    { axis: "Technical domains", value: ratioPercent(input.domainsChosen, input.domainsOffered) },
    { axis: "Areas of interest", value: ratioPercent(input.interestsChosen, input.interestsOffered) },
    { axis: "Roadmap progress", value: clamp(input.milestonesPercent) },
    {
      axis: "Assessment average",
      value: input.assessmentAveragePercent === null ? 0 : clamp(input.assessmentAveragePercent),
    },
  ];
}
