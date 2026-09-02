import { describe, expect, it } from "vitest";
import { describeGap, gaps, isGap, tagCoverage } from "../coverage";

/**
 * The admin-side work queue behind the roadmap's tag-driven panels.
 *
 * A gap here is a claim about students — "fourteen people see an empty shelf" —
 * so the assertions that matter are the ones keeping that number honest: a tag
 * nobody chose is not a gap however bare the catalogue is, and a tag with one
 * entry is not a gap however many students chose it. Both are ways of turning
 * a count into an opinion.
 */

const goals = [
  { id: 1, name: "GATE / Higher studies in India" },
  { id: 2, name: "Placement" },
];
const domains = [
  { id: 10, name: "Cybersecurity" },
  { id: 11, name: "Networking" },
];

describe("tagCoverage", () => {
  it("counts students and resources per tag", () => {
    const rows = tagCoverage(goals, "goal", [1, 1, 2], [1]);
    const gate = rows.find((r) => r.id === 1);
    expect(gate).toMatchObject({ students: 2, resources: 1, kind: "goal" });
  });

  it("keeps a row for a tag nobody has touched", () => {
    // A zero is a fact. Dropping the row would make the table shorter than the
    // option list it claims to describe.
    const rows = tagCoverage(goals, "goal", [], []);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.students === 0 && r.resources === 0)).toBe(true);
  });

  it("counts one row per pair, so a doubly-tagged resource counts once per tag", () => {
    const rows = tagCoverage(domains, "domain", [10], [10, 11]);
    expect(rows.find((r) => r.id === 10)?.resources).toBe(1);
    expect(rows.find((r) => r.id === 11)?.resources).toBe(1);
  });

  it("ignores ids that are not in the option list", () => {
    const rows = tagCoverage(domains, "domain", [10, 99], [99]);
    expect(rows.map((r) => r.id)).toEqual([10, 11]);
    expect(rows.find((r) => r.id === 10)?.students).toBe(1);
  });

  it("puts gaps first, most-affected first", () => {
    const rows = tagCoverage(
      [...goals, { id: 3, name: "Startup" }],
      "goal",
      [1, 2, 2, 2, 3, 3],
      [1], // only GATE is answered
    );
    expect(rows.map((r) => r.name)).toEqual([
      "Placement", // 3 students, 0 resources
      "Startup", // 2 students, 0 resources
      "GATE / Higher studies in India", // answered, so not a gap
    ]);
  });

  it("breaks ties on name rather than reshuffling between page loads", () => {
    const rows = tagCoverage(
      [
        { id: 1, name: "Zebra" },
        { id: 2, name: "Alpha" },
      ],
      "domain",
      [1, 2],
      [],
    );
    expect(rows.map((r) => r.name)).toEqual(["Alpha", "Zebra"]);
  });
});

describe("isGap", () => {
  const row = (students: number, resources: number) => ({
    kind: "domain" as const,
    id: 10,
    name: "Cybersecurity",
    students,
    resources,
  });

  it("is a gap when students are waiting and nothing answers them", () => {
    expect(isGap(row(14, 0))).toBe(true);
  });

  it("is not a gap when nobody has chosen the tag", () => {
    // An empty catalogue for a tag nobody picked affects no one. Flagging it
    // would fill the queue with work that changes nothing.
    expect(isGap(row(0, 0))).toBe(false);
  });

  it("is not a gap once a single entry exists", () => {
    // There is no defensible threshold for how many courses a domain "ought"
    // to have, so anything above zero is left to the curator's judgement.
    expect(isGap(row(200, 1))).toBe(false);
  });

  it("filters to exactly the actionable rows", () => {
    const rows = tagCoverage(domains, "domain", [10, 10, 11], [11]);
    expect(gaps(rows).map((r) => r.name)).toEqual(["Cybersecurity"]);
  });
});

describe("describeGap", () => {
  it("names the tag, the count, and the consequence", () => {
    const line = describeGap({
      kind: "domain",
      id: 10,
      name: "Cybersecurity",
      students: 14,
      resources: 0,
    });
    expect(line).toContain("Cybersecurity");
    expect(line).toContain("14 students");
    expect(line).toContain("empty course shelf");
  });

  it("agrees with itself about a single student", () => {
    const line = describeGap({
      kind: "goal",
      id: 1,
      name: "GATE",
      students: 1,
      resources: 0,
    });
    expect(line).toContain("1 student sees");
    expect(line).not.toContain("students");
  });

  it("names the panel the student is actually looking at", () => {
    const forGoal = describeGap({
      kind: "goal",
      id: 1,
      name: "GATE",
      students: 3,
      resources: 0,
    });
    expect(forGoal).toContain("exam track");
  });

  it("does not suggest what to add", () => {
    // The module counts. What belongs in the catalogue is the curator's call,
    // and a suggestion here would be the invention this codebase rules out.
    const line = describeGap({
      kind: "domain",
      id: 10,
      name: "Cybersecurity",
      students: 14,
      resources: 0,
    });
    expect(line).not.toMatch(/should|try|consider|recommend/i);
  });
});
