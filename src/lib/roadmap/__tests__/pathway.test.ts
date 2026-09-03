import { describe, expect, it } from "vitest";
import { buildPathway, resolvePrimary, stageForSemester } from "../pathway";

/**
 * The pathway makes no claim about what a student has done — that is the
 * whole point of the redesign. Ticking a box was self-assertion dressed up
 * as a percentage; where a student *is* now comes from their recorded
 * semester instead, and what they have achieved is shown separately from
 * records somebody else confirmed.
 *
 * So the assertions here are about position and guidance, not progress:
 * the right stage is current for a given semester, an unrecorded semester
 * marks nothing, and a link is real or absent — never a placeholder.
 */

const GOAL = "IT / Software employment";
const DOMAIN = "Artificial Intelligence & ML";

describe("stageForSemester", () => {
  it("maps each semester pair to its stage", () => {
    expect(stageForSemester(1)).toBe("foundation");
    expect(stageForSemester(2)).toBe("foundation");
    expect(stageForSemester(3)).toBe("core");
    expect(stageForSemester(4)).toBe("core");
    expect(stageForSemester(5)).toBe("specialize");
    expect(stageForSemester(6)).toBe("specialize");
    expect(stageForSemester(7)).toBe("career_ready");
    expect(stageForSemester(8)).toBe("career_ready");
  });

  it("returns null for a semester nobody recorded", () => {
    // Not "assume semester 1" — a profile with no semester has not said
    // where the student is, and a guess would mark the wrong stage.
    expect(stageForSemester(null)).toBeNull();
  });

  it("returns null for a semester outside the degree", () => {
    expect(stageForSemester(0)).toBeNull();
    expect(stageForSemester(9)).toBeNull();
  });
});

describe("buildPathway", () => {
  it("returns exactly the four stages, in order", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 1 });
    expect(pathway.stages.map((s) => s.id)).toEqual([
      "foundation",
      "core",
      "specialize",
      "career_ready",
    ]);
  });

  it("merges the career track and the domain pathway into the same stages", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 1 });
    const foundation = pathway.stages.find((s) => s.id === "foundation")!;
    expect(foundation.items.some((i) => i.label === "Programming fundamentals")).toBe(true);
    expect(foundation.items.some((i) => i.label.startsWith("Python"))).toBe(true);
  });

  it("marks the stage matching the recorded semester as current", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 5 });
    expect(pathway.currentStageId).toBe("specialize");
    expect(pathway.stages.find((s) => s.id === "specialize")?.position).toBe("current");
  });

  it("marks earlier stages past and later stages future", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 5 });
    const positions = pathway.stages.map((s) => s.position);
    expect(positions).toEqual(["past", "past", "current", "future"]);
  });

  it("marks nothing at all when the semester is not recorded", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: null });
    expect(pathway.currentStageId).toBeNull();
    expect(pathway.stages.every((s) => s.position === "unknown")).toBe(true);
  });

  it("does not invent a link when an item has no provider", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 1 });
    const withoutProvider = pathway.stages
      .flatMap((s) => s.items)
      .find((i) => i.label === "Coding practice");
    expect(withoutProvider?.href).toBeNull();
  });

  it("resolves a real link for an item that names a whitelisted provider", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 1 });
    const withProvider = pathway.stages
      .flatMap((s) => s.items)
      .find((i) => i.label.startsWith("Python"));
    expect(withProvider?.href).toMatch(/^https:\/\//);
  });

  it("suggests a starting point from the stage the student is actually in", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 5 });
    const specialize = pathway.stages.find((s) => s.id === "specialize")!;
    expect(pathway.nextBestAction?.item.id).toBe(specialize.items[0].id);
  });

  it("names the goal, the domain, and the semester in its reason", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: 3 });
    expect(pathway.nextBestAction?.reason).toContain(GOAL);
    expect(pathway.nextBestAction?.reason).toContain(DOMAIN);
    expect(pathway.nextBestAction?.reason).toContain("semester 3");
  });

  it("omits the semester from the reason when it is not recorded", () => {
    const pathway = buildPathway({ goalName: GOAL, domainName: DOMAIN, semester: null });
    expect(pathway.nextBestAction?.reason).not.toContain("semester");
  });

  it("returns empty stages rather than throwing for an unknown goal or domain", () => {
    const pathway = buildPathway({
      goalName: "Not a real goal",
      domainName: "Not a real domain",
      semester: 1,
    });
    expect(pathway.stages).toHaveLength(4);
    expect(pathway.stages.every((s) => s.items.length === 0)).toBe(true);
    expect(pathway.nextBestAction).toBeNull();
  });
});

describe("resolvePrimary", () => {
  it("returns null for no selections", () => {
    expect(resolvePrimary([])).toBeNull();
  });

  it("prefers the explicit primary regardless of id order", () => {
    const options = [
      { id: 5, name: "Later id", isPrimary: false },
      { id: 1, name: "Earliest id, not primary", isPrimary: false },
      { id: 3, name: "Marked primary", isPrimary: true },
    ];
    expect(resolvePrimary(options)?.name).toBe("Marked primary");
  });

  it("falls back to the lowest id when nothing is marked primary", () => {
    const options = [
      { id: 5, name: "b", isPrimary: false },
      { id: 1, name: "a", isPrimary: false },
    ];
    expect(resolvePrimary(options)?.name).toBe("a");
  });

  it("returns the only option when there is exactly one", () => {
    expect(resolvePrimary([{ id: 9, name: "solo", isPrimary: false }])?.name).toBe("solo");
  });
});
