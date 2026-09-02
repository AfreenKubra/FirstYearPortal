import { describe, expect, it } from "vitest";
import { filterExamResourcesForGoals, filterResourcesForDomains } from "../filters";

/**
 * The rules behind the roadmap's course shelf and exam track.
 *
 * Both functions decide what a student is shown under a heading that names
 * their own goals and domains, so the failure modes are claims rather than
 * crashes: an untagged entry counted as "for your domain", or last year's exam
 * date presented as upcoming. Those are the cases asserted hardest below.
 */

const course = (
  id: string,
  domainIds: number[],
  kind = "course",
) => ({ id, kind, domainIds });

describe("filterResourcesForDomains", () => {
  const catalogue = [
    course("cyber", [1]),
    course("networks", [2]),
    course("both", [1, 2]),
    course("untagged", []),
  ];

  it("returns entries tagged to the domain", () => {
    expect(filterResourcesForDomains(catalogue, [1]).map((r) => r.id)).toEqual([
      "cyber",
      "both",
    ]);
  });

  it("excludes untagged entries rather than showing everything", () => {
    // The tempting fallback — "no matches, so show the whole catalogue" — is
    // what makes a count under "for your domains" stop meaning anything.
    const ids = filterResourcesForDomains(catalogue, [1, 2]).map((r) => r.id);
    expect(ids).not.toContain("untagged");
  });

  it("unions across domains instead of intersecting them", () => {
    // A student who picked two domains wants material for either. Requiring
    // both tags would empty the shelf for anyone with more than one interest.
    expect(filterResourcesForDomains(catalogue, [1, 2]).map((r) => r.id)).toEqual([
      "cyber",
      "networks",
      "both",
    ]);
  });

  it("counts a doubly-tagged entry once", () => {
    expect(
      filterResourcesForDomains(catalogue, [1, 2]).filter((r) => r.id === "both"),
    ).toHaveLength(1);
  });

  it("returns nothing when the student has chosen no domains", () => {
    expect(filterResourcesForDomains(catalogue, [])).toEqual([]);
  });

  it("narrows by kind when asked", () => {
    const mixed = [course("a", [1], "course"), course("b", [1], "workshop")];
    expect(filterResourcesForDomains(mixed, [1], ["workshop"]).map((r) => r.id)).toEqual([
      "b",
    ]);
  });

  it("preserves input order, so the caller's sort survives", () => {
    // The catalogue query orders verified first, then title. Re-sorting here
    // by anything cost-related would make position an endorsement.
    const ids = filterResourcesForDomains(catalogue, [1, 2]).map((r) => r.id);
    expect(ids).toEqual(["cyber", "networks", "both"]);
  });
});

const exam = (
  id: string,
  goalIds: number[],
  occursOn: string | null,
  kind = "exam",
) => ({ id, title: id, kind, goalIds, occursOn });

describe("filterExamResourcesForGoals", () => {
  const today = "2026-03-01";

  it("keeps only exams, not every resource tagged to the goal", () => {
    const rows = [
      exam("gate", [1], "2026-06-01"),
      exam("syllabus", [1], null, "syllabus"),
    ];
    expect(filterExamResourcesForGoals(rows, [1], today).map((r) => r.id)).toEqual([
      "gate",
    ]);
  });

  it("drops exams whose date has passed", () => {
    // Last year's date is worse than no date: it reads as current until
    // somebody checks it against the official site.
    const rows = [exam("last-year", [1], "2025-02-01"), exam("next", [1], "2026-06-01")];
    expect(filterExamResourcesForGoals(rows, [1], today).map((r) => r.id)).toEqual([
      "next",
    ]);
  });

  it("keeps an exam happening today", () => {
    const rows = [exam("today", [1], today)];
    expect(filterExamResourcesForGoals(rows, [1], today)).toHaveLength(1);
  });

  it("sorts soonest first", () => {
    const rows = [
      exam("late", [1], "2026-12-01"),
      exam("soon", [1], "2026-04-01"),
      exam("middle", [1], "2026-08-01"),
    ];
    expect(filterExamResourcesForGoals(rows, [1], today).map((r) => r.id)).toEqual([
      "soon",
      "middle",
      "late",
    ]);
  });

  it("keeps undated exams and puts them last", () => {
    // Dropping them would hide a resource an administrator deliberately
    // added; promoting them would put a blank where the countdown goes.
    const rows = [exam("undated", [1], null), exam("dated", [1], "2026-06-01")];
    expect(filterExamResourcesForGoals(rows, [1], today).map((r) => r.id)).toEqual([
      "dated",
      "undated",
    ]);
  });

  it("orders two undated exams by title, not arbitrarily", () => {
    const rows = [exam("zebra", [1], null), exam("alpha", [1], null)];
    expect(filterExamResourcesForGoals(rows, [1], today).map((r) => r.id)).toEqual([
      "alpha",
      "zebra",
    ]);
  });

  it("ignores exams tagged to goals the student did not pick", () => {
    const rows = [exam("theirs", [2], "2026-06-01"), exam("mine", [1], "2026-06-01")];
    expect(filterExamResourcesForGoals(rows, [1], today).map((r) => r.id)).toEqual([
      "mine",
    ]);
  });

  it("returns nothing when the student has chosen no goals", () => {
    expect(filterExamResourcesForGoals([exam("gate", [1], "2026-06-01")], [], today)).toEqual(
      [],
    );
  });

  it("does not mutate the array it was given", () => {
    const rows = [exam("late", [1], "2026-12-01"), exam("soon", [1], "2026-04-01")];
    filterExamResourcesForGoals(rows, [1], today);
    expect(rows.map((r) => r.id)).toEqual(["late", "soon"]);
  });
});
