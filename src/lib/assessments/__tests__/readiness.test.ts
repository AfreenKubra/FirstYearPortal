import { describe, expect, it } from "vitest";
import { PERFORMANCE_LEVELS } from "@/config/assessments";
import {
  buildInsights,
  buildReadiness,
  buildSkillAxes,
  buildTrend,
  improvementLabel,
  externalPercentage,
  performanceLevel,
  summariseCategory,
  summariseExternal,
  toScoredAttempts,
  type ExternalResult,
  type RawAttempt,
  type ScoredAttempt,
} from "../readiness";

function attempt(
  attemptNumber: number,
  percentage: number | null,
  submittedAt = `2026-09-0${attemptNumber}T10:00:00Z`,
): ScoredAttempt {
  return {
    attemptNumber,
    percentage,
    submittedAt,
    correct: null,
    wrong: null,
    timeTakenSeconds: null,
  };
}

describe("performanceLevel", () => {
  it("covers 0-100 with no gap between bands", () => {
    for (let p = 0; p <= 100; p += 1) {
      expect(performanceLevel(p), `no band for ${p}`).toBeDefined();
    }
  });

  it("labels each band at its boundaries", () => {
    expect(performanceLevel(0).label).toBe("Needs Improvement");
    expect(performanceLevel(39).label).toBe("Needs Improvement");
    expect(performanceLevel(40).label).toBe("Developing");
    expect(performanceLevel(59).label).toBe("Developing");
    expect(performanceLevel(60).label).toBe("Good");
    expect(performanceLevel(74).label).toBe("Good");
    expect(performanceLevel(75).label).toBe("Strong");
    expect(performanceLevel(89).label).toBe("Strong");
    expect(performanceLevel(90).label).toBe("Excellent");
    expect(performanceLevel(100).label).toBe("Excellent");
  });

  it("always carries a text label, never colour alone", () => {
    for (const level of PERFORMANCE_LEVELS) {
      expect(level.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("clamps rather than throwing on an out-of-range percentage", () => {
    expect(performanceLevel(-5).label).toBe("Needs Improvement");
    expect(performanceLevel(140).label).toBe("Excellent");
  });
});

describe("summariseCategory", () => {
  it("reports null, not zero, when nothing has been attempted", () => {
    const summary = summariseCategory("aptitude", []);
    expect(summary.latestPercentage).toBeNull();
    expect(summary.bestPercentage).toBeNull();
    expect(summary.level).toBeNull();
    expect(summary.attemptCount).toBe(0);
  });

  it("takes latest by attempt number and best by value", () => {
    const summary = summariseCategory("aptitude", [
      attempt(1, 61),
      attempt(3, 78),
      attempt(2, 90),
    ]);
    expect(summary.latestPercentage).toBe(78);
    expect(summary.bestPercentage).toBe(90);
  });

  it("withholds improvement until there are two marked attempts", () => {
    expect(summariseCategory("aptitude", [attempt(1, 61)]).improvement).toBeNull();
    expect(
      summariseCategory("aptitude", [attempt(1, 61), attempt(2, 78)]).improvement,
    ).toBe(17);
  });

  it("ignores attempts nobody has marked yet", () => {
    const summary = summariseCategory("aptitude", [attempt(1, 61), attempt(2, null)]);
    // Two attempts happened; only one has a mark, so there is still nothing
    // to compare and the latest figure is the one that was marked.
    expect(summary.attemptCount).toBe(2);
    expect(summary.latestPercentage).toBe(61);
    expect(summary.improvement).toBeNull();
  });

  it("never scores the personality questionnaire", () => {
    const summary = summariseCategory("personality", [attempt(1, 88)]);
    expect(summary.scored).toBe(false);
    expect(summary.latestPercentage).toBeNull();
    expect(summary.level).toBeNull();
    // It still records that the student completed it.
    expect(summary.attemptCount).toBe(1);
  });
});

describe("buildReadiness", () => {
  it("returns null overall for a student who has sat nothing", () => {
    const readiness = buildReadiness([]);
    expect(readiness.overallPercentage).toBeNull();
    expect(readiness.overallLevel).toBeNull();
    expect(readiness.completedCount).toBe(0);
    expect(readiness.totalAttempts).toBe(0);
    expect(readiness.summaries).toHaveLength(6);
  });

  it("averages over areas attempted, not over all five", () => {
    const readiness = buildReadiness([
      { categoryId: "aptitude", attempts: [attempt(1, 80)] },
      { categoryId: "communication", attempts: [attempt(1, 60)] },
    ]);
    // 70, not 28 — the three untouched areas do not drag it down.
    expect(readiness.overallPercentage).toBe(70);
  });

  it("excludes personality from the overall figure", () => {
    const readiness = buildReadiness([
      { categoryId: "aptitude", attempts: [attempt(1, 80)] },
      { categoryId: "personality", attempts: [attempt(1, 10)] },
    ]);
    expect(readiness.overallPercentage).toBe(80);
  });

  it("counts personality towards completion", () => {
    const readiness = buildReadiness([
      { categoryId: "personality", attempts: [attempt(1, null)] },
    ]);
    expect(readiness.completedCount).toBe(1);
  });

  it("names no strongest or weakest area from a single result", () => {
    const readiness = buildReadiness([
      { categoryId: "aptitude", attempts: [attempt(1, 80)] },
    ]);
    expect(readiness.strongest).toBeNull();
    expect(readiness.needsImprovement).toBeNull();
  });

  it("ranks strongest and weakest once two areas have results", () => {
    const readiness = buildReadiness([
      { categoryId: "technical", attempts: [attempt(1, 82)] },
      { categoryId: "communication", attempts: [attempt(1, 64)] },
      { categoryId: "aptitude", attempts: [attempt(1, 76)] },
    ]);
    expect(readiness.strongest?.categoryId).toBe("technical");
    expect(readiness.needsImprovement?.categoryId).toBe("communication");
  });

  it("picks the largest real gain as most improved, and none when nobody gained", () => {
    const gained = buildReadiness([
      { categoryId: "logical_reasoning", attempts: [attempt(1, 61), attempt(2, 78)] },
      { categoryId: "aptitude", attempts: [attempt(1, 70), attempt(2, 74)] },
    ]);
    expect(gained.mostImproved?.categoryId).toBe("logical_reasoning");

    const declined = buildReadiness([
      { categoryId: "aptitude", attempts: [attempt(1, 80), attempt(2, 70)] },
    ]);
    expect(declined.mostImproved).toBeNull();
  });

  it("totals attempts across every area", () => {
    const readiness = buildReadiness([
      { categoryId: "aptitude", attempts: [attempt(1, 61), attempt(2, 72)] },
      { categoryId: "personality", attempts: [attempt(1, null)] },
    ]);
    expect(readiness.totalAttempts).toBe(3);
  });
});

describe("buildSkillAxes", () => {
  it("has five axes and never includes personality", () => {
    const axes = buildSkillAxes(buildReadiness([]).summaries);
    expect(axes).toHaveLength(5);
    expect(axes.map((a) => a.label)).not.toContain("Personality Assessment");
  });

  it("plots an unattempted area at zero but flags it as unattempted", () => {
    const readiness = buildReadiness([
      { categoryId: "aptitude", attempts: [attempt(1, 76)] },
    ]);
    const axes = buildSkillAxes(readiness.summaries);
    const aptitude = axes.find((a) => a.label === "Aptitude");
    const other = axes.find((a) => a.label === "Communication Skills");

    expect(aptitude).toEqual({ label: "Aptitude", value: 76, attempted: true });
    expect(other?.value).toBe(0);
    expect(other?.attempted).toBe(false);
  });
});

describe("buildTrend and improvementLabel", () => {
  it("orders by attempt number and drops unmarked attempts", () => {
    const trend = buildTrend([attempt(3, 78), attempt(1, 61), attempt(2, null)]);
    expect(trend).toEqual([
      { attemptNumber: 1, percentage: 61 },
      { attemptNumber: 3, percentage: 78 },
    ]);
  });

  it("says nothing about improvement from a single point", () => {
    expect(improvementLabel(buildTrend([attempt(1, 61)]))).toBeNull();
  });

  it("states the gain, the drop, and the absence of either", () => {
    expect(improvementLabel([
      { attemptNumber: 1, percentage: 61 },
      { attemptNumber: 3, percentage: 78 },
    ])).toBe("Improved by 17 percentage points since your first attempt");

    expect(improvementLabel([
      { attemptNumber: 1, percentage: 78 },
      { attemptNumber: 2, percentage: 61 },
    ])).toBe("Down by 17 percentage points since your first attempt");

    expect(improvementLabel([
      { attemptNumber: 1, percentage: 70 },
      { attemptNumber: 2, percentage: 70 },
    ])).toBe("No change since your first attempt");
  });
});

describe("buildInsights", () => {
  it("returns nothing to say for an untouched account rather than filler", () => {
    expect(buildInsights(buildReadiness([]))).toEqual([
      {
        heading: "Recommended next step",
        detail: "Take the Aptitude assessment — you have not attempted it yet.",
      },
    ]);
  });

  it("names the real strongest, weakest, and most improved areas", () => {
    const readiness = buildReadiness([
      { categoryId: "technical", attempts: [attempt(1, 82)] },
      { categoryId: "communication", attempts: [attempt(1, 64)] },
      { categoryId: "logical_reasoning", attempts: [attempt(1, 61), attempt(2, 78)] },
    ]);
    const insights = buildInsights(readiness);
    const byHeading = new Map(insights.map((i) => [i.heading, i.detail]));

    expect(byHeading.get("Strongest area")).toBe("Technical Aptitude — 82%");
    expect(byHeading.get("Needs attention")).toBe("Communication Skills — 64%");
    expect(byHeading.get("Largest improvement")).toContain("Logical Reasoning");
    expect(byHeading.get("Largest improvement")).toContain("17 percentage points");
  });

  it("recommends retaking the weakest area only once nothing is left untried", () => {
    const readiness = buildReadiness([
      { categoryId: "aptitude", attempts: [attempt(1, 76)] },
      { categoryId: "logical_reasoning", attempts: [attempt(1, 68)] },
      { categoryId: "technical", attempts: [attempt(1, 82)] },
      { categoryId: "communication", attempts: [attempt(1, 64)] },
      { categoryId: "soft_skills", attempts: [attempt(1, 73)] },
      { categoryId: "personality", attempts: [attempt(1, null)] },
    ]);
    const step = buildInsights(readiness).find(
      (i) => i.heading === "Recommended next step",
    );
    expect(step?.detail).toBe("Retake the Communication Skills assessment.");
  });
});

describe("externalPercentage", () => {
  const result = (over: Partial<ExternalResult> = {}): ExternalResult => ({
    id: "e1",
    categoryId: "aptitude",
    platform: "TrainThinking",
    testName: "CCAT practice",
    scoreLabel: "39/50",
    scoreValue: 39,
    maxScore: 50,
    takenOn: "2026-09-01",
    verification: "self_reported",
    reviewerNote: null,
    ...over,
  });

  it("converts a score out of a maximum", () => {
    expect(externalPercentage(result())).toBe(78);
  });

  it("returns null for a result that is not a score out of anything", () => {
    // "Elite", "Band 7", "Pass" are real results with no position on a
    // 0-100 scale. Inventing one would be worse than showing the words.
    expect(
      externalPercentage(result({ scoreValue: null, maxScore: null, scoreLabel: "Elite" })),
    ).toBeNull();
  });

  it("returns null for a rejected result", () => {
    // Somebody looked at it and declined it. Plotting it anyway would let a
    // rejected claim keep counting.
    expect(externalPercentage(result({ verification: "rejected" }))).toBeNull();
  });

  it("returns null rather than dividing by zero", () => {
    expect(externalPercentage(result({ scoreValue: 0, maxScore: 0 }))).toBeNull();
  });

  it("handles a zero score without confusing it for missing data", () => {
    expect(externalPercentage(result({ scoreValue: 0, maxScore: 50 }))).toBe(0);
  });
});

describe("summariseExternal", () => {
  const make = (
    id: string,
    over: Partial<ExternalResult> = {},
  ): ExternalResult => ({
    id,
    categoryId: "aptitude",
    platform: "TrainThinking",
    testName: "Practice",
    scoreLabel: "",
    scoreValue: 40,
    maxScore: 50,
    takenOn: "2026-09-01",
    verification: "self_reported",
    reviewerNote: null,
    ...over,
  });

  it("returns empty rather than throwing when nothing is recorded", () => {
    const summary = summariseExternal([], "aptitude");
    expect(summary.results).toEqual([]);
    expect(summary.bestVerifiedPercentage).toBeNull();
    expect(summary.bestUnverifiedPercentage).toBeNull();
    expect(summary.awaitingReview).toBe(0);
  });

  it("only picks up results for the area asked for", () => {
    const summary = summariseExternal(
      [make("a"), make("b", { categoryId: "communication" }), make("c", { categoryId: null })],
      "aptitude",
    );
    expect(summary.results.map((r) => r.id)).toEqual(["a"]);
  });

  it("keeps verified and unverified bests apart", () => {
    // The whole point of the split: a number a member of staff checked and a
    // number typed in last night must never be reported as the same fact.
    const summary = summariseExternal(
      [
        make("a", { verification: "verified", scoreValue: 30 }),
        make("b", { verification: "self_reported", scoreValue: 50 }),
      ],
      "aptitude",
    );
    expect(summary.bestVerifiedPercentage).toBe(60);
    expect(summary.bestUnverifiedPercentage).toBe(100);
  });

  it("excludes rejected results from both bests", () => {
    const summary = summariseExternal(
      [make("a", { verification: "rejected", scoreValue: 50 })],
      "aptitude",
    );
    expect(summary.bestVerifiedPercentage).toBeNull();
    expect(summary.bestUnverifiedPercentage).toBeNull();
    // It is still listed, so the student can see it was declined.
    expect(summary.results).toHaveLength(1);
  });

  it("counts only unreviewed results as awaiting review", () => {
    const summary = summariseExternal(
      [
        make("a"),
        make("b"),
        make("c", { verification: "verified" }),
        make("d", { verification: "rejected" }),
      ],
      "aptitude",
    );
    expect(summary.awaitingReview).toBe(2);
  });

  it("orders by date taken, most recent first", () => {
    const summary = summariseExternal(
      [
        make("old", { takenOn: "2026-01-05" }),
        make("new", { takenOn: "2026-09-05" }),
        make("mid", { takenOn: "2026-05-05" }),
      ],
      "aptitude",
    );
    expect(summary.results.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("toScoredAttempts", () => {
  const raw = (over: Partial<RawAttempt> = {}): RawAttempt => ({
    attemptNumber: 1,
    status: "graded",
    percentage: 78,
    submittedAt: "2026-09-07T10:00:00Z",
    correctCount: 16,
    wrongCount: 4,
    timeTakenSeconds: 960,
    ...over,
  });

  it("reports a graded attempt", () => {
    expect(toScoredAttempts([raw()])).toEqual([
      {
        attemptNumber: 1,
        percentage: 78,
        submittedAt: "2026-09-07T10:00:00Z",
        correct: 16,
        wrong: 4,
        timeTakenSeconds: 960,
      },
    ]);
  });

  it("drops an attempt still being sat", () => {
    // Counting it would add to the student's attempt total the moment they
    // opened the paper, before answering anything.
    expect(toScoredAttempts([raw({ status: "in_progress", percentage: null })])).toEqual([]);
  });

  it("drops an abandoned attempt", () => {
    expect(toScoredAttempts([raw({ status: "abandoned" })])).toEqual([]);
  });

  it("keeps a submitted attempt that nobody has marked yet", () => {
    // It counts as an attempt and shows in the history as awaiting marking,
    // but carries no percentage, so it is never drawn as a score.
    const [result] = toScoredAttempts([
      raw({ status: "submitted", percentage: null }),
    ]);
    expect(result).toBeDefined();
    expect(result.percentage).toBeNull();
  });

  it("feeds straight into a summary, so a submitted score reaches its card", () => {
    // The end-to-end shape the dashboard depends on: raw rows in, a card's
    // status/attempts/best/last out, with nothing typed in between.
    const summary = summariseCategory(
      "aptitude",
      toScoredAttempts([
        raw({ attemptNumber: 1, percentage: 61, submittedAt: "2026-09-01T09:00:00Z" }),
        raw({ attemptNumber: 2, percentage: 78, submittedAt: "2026-09-07T09:00:00Z" }),
        raw({ attemptNumber: 3, status: "in_progress", percentage: null }),
      ]),
    );

    expect(summary.attemptCount).toBe(2);
    expect(summary.latestPercentage).toBe(78);
    expect(summary.bestPercentage).toBe(78);
    expect(summary.level?.label).toBe("Strong");
    expect(summary.lastAttemptAt).toBe("2026-09-07T09:00:00Z");
    expect(summary.improvement).toBe(17);
  });
});
