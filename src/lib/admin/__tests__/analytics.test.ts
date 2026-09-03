import { describe, expect, it } from "vitest";
import {
  averageOf,
  completionRate,
  describeAssignment,
  summariseDepartments,
  summariseInstitution,
  tallyBy,
  summariseMarks,
  type AnalyticsStudent,
  type AnalyticsMarkRow,
} from "../analytics";

function student(overrides: Partial<AnalyticsStudent> = {}): AnalyticsStudent {
  return {
    id: crypto.randomUUID(),
    departmentCode: "CSE",
    semester: 1,
    section: "A",
    quota: "cet",
    residenceType: "home",
    tenthPercentage: 90,
    twelfthPercentage: 85,
    completionPercent: 100,
    ...overrides,
  };
}

describe("averageOf", () => {
  it("averages the values present", () => {
    expect(averageOf([80, 90, 100])).toBe(90);
  });

  it("skips nulls rather than counting them as zero", () => {
    // The point of the whole function: [90, null] must be 90, not 45.
    expect(averageOf([90, null, undefined])).toBe(90);
  });

  it("returns null when nothing is present", () => {
    expect(averageOf([null, undefined])).toBeNull();
  });

  it("rounds to two decimal places", () => {
    expect(averageOf([80, 85, 91])).toBe(85.33);
  });

  it("counts a legitimate zero", () => {
    expect(averageOf([0, 100])).toBe(50);
  });
});

describe("completionRate", () => {
  it("returns 0 for an empty cohort rather than dividing by zero", () => {
    expect(completionRate([])).toBe(0);
  });

  it("counts only 100% profiles as complete", () => {
    const rows = [
      student({ completionPercent: 100 }),
      student({ completionPercent: 99 }),
      student({ completionPercent: 100 }),
      student({ completionPercent: 20 }),
    ];
    expect(completionRate(rows)).toBe(50);
  });
});

describe("tallyBy", () => {
  it("counts and sorts by frequency", () => {
    const rows = [
      student({ departmentCode: "CSE" }),
      student({ departmentCode: "ECE" }),
      student({ departmentCode: "CSE" }),
    ];
    expect(tallyBy(rows, (r) => r.departmentCode)).toEqual([
      { label: "CSE", count: 2 },
      { label: "ECE", count: 1 },
    ]);
  });

  it("groups nulls under 'Not set' instead of dropping them", () => {
    const rows = [student({ quota: null }), student({ quota: "cet" })];
    const result = tallyBy(rows, (r) => r.quota);
    expect(result).toContainEqual({ label: "Not set", count: 1 });
  });

  it("breaks frequency ties alphabetically for a stable order", () => {
    const rows = [
      student({ departmentCode: "ECE" }),
      student({ departmentCode: "AIML" }),
    ];
    expect(tallyBy(rows, (r) => r.departmentCode).map((s) => s.label)).toEqual([
      "AIML",
      "ECE",
    ]);
  });
});

describe("summariseDepartments", () => {
  const departments = [
    { code: "CSE", name: "Computer Science" },
    { code: "ECE", name: "Electronics" },
    { code: "MECH", name: "Mechanical" },
  ];

  it("includes departments with no students", () => {
    const summary = summariseDepartments([student({ departmentCode: "CSE" })], departments);
    const mech = summary.find((d) => d.code === "MECH")!;

    // An empty department must appear as 0, not vanish — absent reads as
    // "no data collected", which is a different claim.
    expect(mech.total).toBe(0);
    expect(mech.completionRate).toBe(0);
    expect(mech.avgTenth).toBeNull();
  });

  it("computes per-department completion and averages", () => {
    const rows = [
      student({ departmentCode: "CSE", completionPercent: 100, tenthPercentage: 90 }),
      student({ departmentCode: "CSE", completionPercent: 40, tenthPercentage: 80 }),
      student({ departmentCode: "ECE", completionPercent: 100, tenthPercentage: 70 }),
    ];
    const summary = summariseDepartments(rows, departments);
    const cse = summary.find((d) => d.code === "CSE")!;

    expect(cse.total).toBe(2);
    expect(cse.complete).toBe(1);
    expect(cse.incomplete).toBe(1);
    expect(cse.completionRate).toBe(50);
    expect(cse.avgTenth).toBe(85);
  });

  it("groups every away-from-home residence type together", () => {
    const rows = [
      student({ residenceType: "hostel" }),
      student({ residenceType: "pg" }),
      student({ residenceType: "flat" }),
      student({ residenceType: "home" }),
      student({ residenceType: null }),
    ];
    const cse = summariseDepartments(rows, departments).find(
      (d) => d.code === "CSE",
    )!;

    // hostel + pg + flat all count as living away; null counts as neither,
    // so the two figures deliberately do not have to sum to the total.
    expect(cse.livingAway).toBe(3);
    expect(cse.livingAtHome).toBe(1);
    expect(cse.total).toBe(5);
  });

  it("does not count an unset residence type as living away", () => {
    const cse = summariseDepartments(
      [student({ residenceType: null })],
      departments,
    ).find((d) => d.code === "CSE")!;

    expect(cse.livingAway).toBe(0);
    expect(cse.livingAtHome).toBe(0);
  });

  it("orders by student count, descending", () => {
    const rows = [
      student({ departmentCode: "ECE" }),
      student({ departmentCode: "ECE" }),
      student({ departmentCode: "CSE" }),
    ];
    expect(summariseDepartments(rows, departments)[0].code).toBe("ECE");
  });
});

describe("summariseInstitution", () => {
  it("summarises an empty institution without dividing by zero", () => {
    const stats = summariseInstitution([]);
    expect(stats.totalStudents).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.avgTenth).toBeNull();
  });

  it("labels quota and residence codes for display", () => {
    const stats = summariseInstitution([
      student({ quota: "comedk", residenceType: "pg" }),
    ]);
    expect(stats.byQuota[0].label).toBe("COMEDK");
    expect(stats.byResidence[0].label).toBe("PG / Paying guest");
  });

  it("uses the supplied state accessor", () => {
    const stats = summariseInstitution([student(), student()], () => "Karnataka");
    expect(stats.byState).toEqual([{ label: "Karnataka", count: 2 }]);
  });
});

describe("describeAssignment", () => {
  it("describes a named-student assignment", () => {
    expect(
      describeAssignment({
        studentName: "Aisha (1HK24CS001)",
        departmentCode: null,
        semester: null,
        section: null,
        isMentor: true,
      }),
    ).toBe("Mentor — Aisha (1HK24CS001) (named student)");
  });

  it("spells out NULL scope columns as 'all' rather than leaving them blank", () => {
    expect(
      describeAssignment({
        departmentCode: "CSE",
        semester: null,
        section: null,
        isMentor: false,
      }),
    ).toBe("Viewer — CSE · all semesters · all sections");
  });

  it("describes a fully narrowed scope", () => {
    expect(
      describeAssignment({
        departmentCode: "AIML",
        semester: 2,
        section: "B",
        isMentor: true,
      }),
    ).toBe("Mentor — AIML · Semester 2 · Section B");
  });
});

describe("summariseMarks", () => {
  const COMPONENTS = [
    { code: "ia1", label: "1st IA", maxMarks: 20 },
    { code: "ia2", label: "2nd IA", maxMarks: 20 },
    { code: "activity", label: "Activity", maxMarks: 10 },
  ];

  function mark(over: Partial<AnalyticsMarkRow> = {}): AnalyticsMarkRow {
    return {
      studentId: "s1",
      departmentCode: "AIML",
      componentCode: "ia1",
      marks: 10,
      maxMarks: 20,
      released: true,
      ...over,
    };
  }

  it("counts recorded and released entries", () => {
    const result = summariseMarks(
      [
        mark({ marks: 10, released: true }),
        mark({ componentCode: "ia2", marks: 15, released: false }),
      ],
      COMPONENTS,
    );

    expect(result.entriesRecorded).toBe(2);
    expect(result.entriesReleased).toBe(1);
  });

  // The rule that matters most: an unmarked cohort is not a failing one.
  it("skips unmarked entries rather than counting them as zero", () => {
    const result = summariseMarks(
      [
        mark({ marks: 20, maxMarks: 20 }),
        mark({ studentId: "s2", marks: null }),
      ],
      COMPONENTS,
    );

    expect(result.entriesRecorded).toBe(1);
    expect(result.byComponent[0].averagePercent).toBe(100);
    expect(result.studentsWithMarks).toBe(1);
  });

  // Pooling a 20-mark IA with a 10-mark activity would be meaningless, so
  // each is normalised against its own maximum.
  it("averages each component against its own maximum", () => {
    const result = summariseMarks(
      [
        mark({ componentCode: "ia1", marks: 10, maxMarks: 20 }),
        mark({ componentCode: "activity", marks: 10, maxMarks: 10 }),
      ],
      COMPONENTS,
    );

    const ia1 = result.byComponent.find((c) => c.code === "ia1")!;
    const activity = result.byComponent.find((c) => c.code === "activity")!;

    expect(ia1.averagePercent).toBe(50);
    expect(activity.averagePercent).toBe(100);
  });

  it("normalises against the row's own maximum, not the component's current one", () => {
    // A component whose maximum was raised after marking must not re-scale
    // the figures already recorded against the old one.
    const result = summariseMarks(
      [mark({ componentCode: "ia1", marks: 5, maxMarks: 10 })],
      [{ code: "ia1", label: "1st IA", maxMarks: 20 }],
    );

    expect(result.byComponent[0].averagePercent).toBe(50);
  });

  it("reports a component with nothing recorded as null, not zero", () => {
    const result = summariseMarks([mark({ componentCode: "ia1" })], COMPONENTS);
    const ia2 = result.byComponent.find((c) => c.code === "ia2")!;

    expect(ia2.recorded).toBe(0);
    expect(ia2.averagePercent).toBeNull();
  });

  it("counts a student once per department however many components they carry", () => {
    const result = summariseMarks(
      [
        mark({ studentId: "s1", componentCode: "ia1" }),
        mark({ studentId: "s1", componentCode: "ia2" }),
        mark({ studentId: "s2", componentCode: "ia1", departmentCode: "CSE" }),
      ],
      COMPONENTS,
    );

    expect(result.studentsWithMarks).toBe(2);
    expect(result.markedByDepartment).toEqual([
      { label: "AIML", count: 1 },
      { label: "CSE", count: 1 },
    ]);
  });

  it("returns an empty summary for no marks at all", () => {
    const result = summariseMarks([], COMPONENTS);

    expect(result.studentsWithMarks).toBe(0);
    expect(result.entriesRecorded).toBe(0);
    expect(result.markedByDepartment).toEqual([]);
    expect(result.byComponent.every((c) => c.averagePercent === null)).toBe(true);
  });
});
