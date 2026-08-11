import { describe, expect, it } from "vitest";
import {
  computeCompletionPercent,
  evaluateSections,
  isProfileComplete,
  type ProfileSnapshot,
} from "../profile-completion";

function snapshot(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    identity: {
      fullName: "Aisha Rahman",
      usn: "1HK24CS001",
      departmentCode: "CSE",
      guardianName: "Rahman K",
      guardianPhone: "9880012345",
      residenceType: "home",
    },
    academic: {
      tenthPercentage: 92.4,
      twelfthPercentage: 88.1,
      quota: "cet",
      semester: 1,
      section: "A",
      admissionYear: 2024,
    },
    interestIds: [1, 4],
    goalIds: [1],
    domainIds: [3, 5],
    ...overrides,
  };
}

describe("computeCompletionPercent", () => {
  it("reports 100 for a fully populated profile", () => {
    expect(computeCompletionPercent(snapshot())).toBe(100);
  });

  it("drops by one section when interests are empty", () => {
    expect(computeCompletionPercent(snapshot({ interestIds: [] }))).toBe(80);
  });

  it("counts each required section equally", () => {
    const bare = snapshot({
      academic: {},
      interestIds: [],
      goalIds: [],
      domainIds: [],
    });
    // Only identity is complete: 1 of 5.
    expect(computeCompletionPercent(bare)).toBe(20);
  });

  it("returns 0 when nothing is filled in", () => {
    const empty = snapshot({
      identity: {},
      academic: {},
      interestIds: [],
      goalIds: [],
      domainIds: [],
    });
    expect(computeCompletionPercent(empty)).toBe(0);
  });

  it("treats a blank string as unfilled, not as a value", () => {
    const blank = snapshot({
      identity: { ...snapshot().identity, guardianName: "   " },
    });
    expect(computeCompletionPercent(blank)).toBe(80);
  });

  it("does not require entrance rank, so management-quota students can reach 100", () => {
    const noRank = snapshot({
      academic: { ...snapshot().academic, quota: "management" },
    });
    expect(computeCompletionPercent(noRank)).toBe(100);
  });

  it("accepts a legitimate zero percentage rather than reading it as empty", () => {
    const zero = snapshot({
      academic: { ...snapshot().academic, tenthPercentage: 0 },
    });
    expect(computeCompletionPercent(zero)).toBe(100);
  });
});

describe("evaluateSections", () => {
  it("explains what is missing so the UI never has to guess", () => {
    const sections = evaluateSections(snapshot({ goalIds: [] }));
    const goals = sections.find((s) => s.key === "goals")!;

    expect(goals.complete).toBe(false);
    expect(goals.missing).toMatch(/career goal/i);
  });

  it("leaves `missing` null on complete sections", () => {
    for (const section of evaluateSections(snapshot())) {
      expect(section.missing).toBeNull();
    }
  });
});

describe("isProfileComplete", () => {
  it("gates the dashboard until every required section is saved", () => {
    expect(isProfileComplete(snapshot())).toBe(true);
    expect(isProfileComplete(snapshot({ domainIds: [] }))).toBe(false);
  });
});
