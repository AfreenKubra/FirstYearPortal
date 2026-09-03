import { describe, expect, it } from "vitest";
import {
  EXTERNAL_PLATFORMS,
  SELF_REPORTED_NOTICE,
  SKILL_CATEGORIES,
  SKILL_CATEGORY_VALUES,
} from "../assessments";

/**
 * The skills table and its external links are static configuration, not
 * data pulled from anywhere — so the assertions here are about internal
 * consistency: no duplicate ids to silently merge two rows, no external
 * link that could resolve to something other than https.
 */

describe("SKILL_CATEGORIES", () => {
  it("has exactly the six areas the assessment page names", () => {
    expect(SKILL_CATEGORIES).toHaveLength(6);
  });

  it("has unique ids", () => {
    const ids = SKILL_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes personality, which the assessment page links internally", () => {
    expect(SKILL_CATEGORIES.some((c) => c.id === "personality")).toBe(true);
  });

  it("keeps SKILL_CATEGORY_VALUES in sync with the category list", () => {
    expect(SKILL_CATEGORY_VALUES).toEqual(SKILL_CATEGORIES.map((c) => c.id));
  });
});

describe("EXTERNAL_PLATFORMS", () => {
  it("only links to https", () => {
    for (const platform of EXTERNAL_PLATFORMS) {
      expect(platform.url).toMatch(/^https:\/\//);
    }
  });

  it("has unique ids", () => {
    const ids = EXTERNAL_PLATFORMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("SELF_REPORTED_NOTICE", () => {
  it("says the score is unverified, not just self-reported", () => {
    // "Self-reported" alone could be misread as a milder synonym for
    // verified. The notice has to rule that reading out.
    expect(SELF_REPORTED_NOTICE.toLowerCase()).toContain("not verified");
  });
});
