import { describe, expect, it } from "vitest";
import {
  pivotToComponents,
  releasedOnly,
  sumRecorded,
  validateMark,
} from "../compute";
import type { MarkComponent, MarkEntry } from "@/config/marks";

const COMPONENTS: MarkComponent[] = [
  { code: "ia1", label: "1st IA", maxMarks: 20, sortOrder: 10, isActive: true },
  { code: "ia2", label: "2nd IA", maxMarks: 20, sortOrder: 20, isActive: true },
  {
    code: "assignment",
    label: "Assignment",
    maxMarks: 10,
    sortOrder: 30,
    isActive: true,
  },
  {
    code: "activity",
    label: "Activity",
    maxMarks: 10,
    sortOrder: 40,
    isActive: true,
  },
];

function entry(over: Partial<MarkEntry> & { componentCode: string }): MarkEntry {
  return {
    marks: null,
    maxMarks: 20,
    remark: null,
    publishedAt: "2026-09-01T10:00:00Z",
    ...over,
  };
}

describe("sumRecorded", () => {
  it("adds the components that carry a mark", () => {
    expect(
      sumRecorded([
        entry({ componentCode: "ia1", marks: 17, maxMarks: 20 }),
        entry({ componentCode: "ia2", marks: 18, maxMarks: 20 }),
        entry({ componentCode: "assignment", marks: 9, maxMarks: 10 }),
      ]),
    ).toEqual({ scored: 44, outOf: 50, recordedCount: 3 });
  });

  // The failure this guards against is the alarming one: a student who has
  // sat one paper being shown a total implying they scored zero on the rest.
  it("skips unmarked components instead of counting them as zero", () => {
    expect(
      sumRecorded([
        entry({ componentCode: "ia1", marks: 15, maxMarks: 20 }),
        entry({ componentCode: "ia2", marks: null, maxMarks: 20 }),
      ]),
    ).toEqual({ scored: 15, outOf: 20, recordedCount: 1 });
  });

  it("returns a zero total for a card with nothing recorded", () => {
    expect(
      sumRecorded([
        entry({ componentCode: "ia1", marks: null }),
        entry({ componentCode: "ia2", marks: null }),
      ]),
    ).toEqual({ scored: 0, outOf: 0, recordedCount: 0 });
  });

  it("keeps half marks exact rather than drifting", () => {
    const { scored } = sumRecorded([
      entry({ componentCode: "ia1", marks: 17.5, maxMarks: 20 }),
      entry({ componentCode: "ia2", marks: 18.1, maxMarks: 20 }),
      entry({ componentCode: "assignment", marks: 9.3, maxMarks: 10 }),
    ]);
    expect(scored).toBe(44.9);
  });

  it("counts a genuine zero, which is not the same as a blank", () => {
    expect(
      sumRecorded([entry({ componentCode: "ia1", marks: 0, maxMarks: 20 })]),
    ).toEqual({ scored: 0, outOf: 20, recordedCount: 1 });
  });
});

describe("releasedOnly", () => {
  it("drops components that have not been released", () => {
    const result = releasedOnly([
      entry({ componentCode: "ia1", marks: 17 }),
      entry({ componentCode: "ia2", marks: 18, publishedAt: null }),
    ]);
    expect(result.map((e) => e.componentCode)).toEqual(["ia1"]);
  });

  // Staff can read unreleased rows, so a staff-side preview of a student's
  // card must be filtered or it shows a total the student cannot yet see.
  it("makes a staff preview match what the student sees", () => {
    const all = [
      entry({ componentCode: "ia1", marks: 17, maxMarks: 20 }),
      entry({ componentCode: "ia2", marks: 18, maxMarks: 20, publishedAt: null }),
    ];
    expect(sumRecorded(releasedOnly(all))).toEqual({
      scored: 17,
      outOf: 20,
      recordedCount: 1,
    });
  });
});

describe("pivotToComponents", () => {
  it("returns one cell per component, in definition order", () => {
    const result = pivotToComponents(COMPONENTS, [
      entry({ componentCode: "activity", marks: 8, maxMarks: 10 }),
      entry({ componentCode: "ia1", marks: 12, maxMarks: 20 }),
    ]);

    expect(result.map((e) => e.componentCode)).toEqual([
      "ia1",
      "ia2",
      "assignment",
      "activity",
    ]);
    expect(result.map((e) => e.marks)).toEqual([12, null, null, 8]);
  });

  // A subject nobody has touched still has to render a full row, or the grid
  // stops lining up with its own header.
  it("fills components that have no row at all", () => {
    const result = pivotToComponents(COMPONENTS, []);
    expect(result).toHaveLength(4);
    expect(result.every((e) => e.marks === null)).toBe(true);
    expect(result.map((e) => e.maxMarks)).toEqual([20, 20, 10, 10]);
  });

  it("ignores a stored row for a component no longer defined", () => {
    const result = pivotToComponents(COMPONENTS, [
      entry({ componentCode: "retired_component", marks: 5 }),
    ]);
    expect(result.map((e) => e.componentCode)).not.toContain(
      "retired_component",
    );
  });
});

describe("validateMark", () => {
  it("accepts a mark inside the ceiling", () => {
    expect(validateMark("17", 20)).toEqual({ ok: true, value: 17 });
  });

  it("treats a blank as clearing the mark", () => {
    expect(validateMark("", 20)).toEqual({ ok: true, value: null });
    expect(validateMark("   ", 20)).toEqual({ ok: true, value: null });
  });

  it("accepts a half mark", () => {
    expect(validateMark("17.5", 20)).toEqual({ ok: true, value: 17.5 });
  });

  it("refuses a mark above the ceiling", () => {
    expect(validateMark("21", 20)).toEqual({
      ok: false,
      error: "Maximum is 20.",
    });
  });

  it("refuses a negative mark", () => {
    expect(validateMark("-1", 20).ok).toBe(false);
  });

  it("refuses text", () => {
    expect(validateMark("absent", 20).ok).toBe(false);
  });

  it("accepts zero, which is a real mark", () => {
    expect(validateMark("0", 20)).toEqual({ ok: true, value: 0 });
  });
});
