import { describe, expect, it } from "vitest";
import { buildRadarData } from "../radar";

/**
 * The roadmap's radar chart plots five ratios, not an invented "how you're
 * doing" score — so the assertions that matter are about the edges where a
 * naive percentage calculation breaks: nothing offered, nothing chosen, no
 * roadmap yet, no graded assessment yet. Every one of those must still
 * produce a plottable number, never `NaN`, and never something above 100 or
 * below 0.
 */

const FULL_INPUT = {
  goalsChosen: 2,
  goalsOffered: 4,
  domainsChosen: 1,
  domainsOffered: 5,
  interestsChosen: 3,
  interestsOffered: 3,
  milestonesPercent: 40,
  assessmentAveragePercent: 72.5,
};

describe("buildRadarData", () => {
  it("returns exactly five axes", () => {
    expect(buildRadarData(FULL_INPUT)).toHaveLength(5);
  });

  it("computes each axis as chosen/offered, as a percentage", () => {
    const data = buildRadarData(FULL_INPUT);
    expect(data.find((d) => d.axis === "Career goals")?.value).toBe(50);
    expect(data.find((d) => d.axis === "Technical domains")?.value).toBe(20);
    expect(data.find((d) => d.axis === "Areas of interest")?.value).toBe(100);
  });

  it("carries milestone and assessment percentages through directly", () => {
    const data = buildRadarData(FULL_INPUT);
    expect(data.find((d) => d.axis === "Roadmap progress")?.value).toBe(40);
    expect(data.find((d) => d.axis === "Assessment average")?.value).toBe(72.5);
  });

  it("renders 0, not NaN, when nothing is offered at all", () => {
    const data = buildRadarData({
      ...FULL_INPUT,
      goalsChosen: 0,
      goalsOffered: 0,
    });
    const goals = data.find((d) => d.axis === "Career goals")?.value;
    expect(goals).toBe(0);
    expect(Number.isNaN(goals)).toBe(false);
  });

  it("renders 0 for assessment average when nothing has been graded", () => {
    const data = buildRadarData({ ...FULL_INPUT, assessmentAveragePercent: null });
    expect(data.find((d) => d.axis === "Assessment average")?.value).toBe(0);
  });

  it("still returns five rows for a completely empty profile", () => {
    const data = buildRadarData({
      goalsChosen: 0,
      goalsOffered: 4,
      domainsChosen: 0,
      domainsOffered: 5,
      interestsChosen: 0,
      interestsOffered: 3,
      milestonesPercent: 0,
      assessmentAveragePercent: null,
    });
    expect(data).toHaveLength(5);
    expect(data.every((d) => d.value === 0)).toBe(true);
  });

  it("clamps a value above 100", () => {
    const data = buildRadarData({ ...FULL_INPUT, milestonesPercent: 140 });
    expect(data.find((d) => d.axis === "Roadmap progress")?.value).toBe(100);
  });

  it("clamps a value below 0", () => {
    const data = buildRadarData({ ...FULL_INPUT, assessmentAveragePercent: -5 });
    expect(data.find((d) => d.axis === "Assessment average")?.value).toBe(0);
  });

  it("never exceeds 100 even when chosen exceeds offered", () => {
    // Shouldn't happen with real data, but a stale lookup list must not turn
    // into a chart that reads over 100%.
    const data = buildRadarData({ ...FULL_INPUT, goalsChosen: 9, goalsOffered: 4 });
    expect(data.find((d) => d.axis === "Career goals")?.value).toBe(100);
  });
});
