import { describe, expect, it } from "vitest";
import {
  averageOf,
  completionRate,
  describeAssignment,
  summariseDepartments,
  summariseInstitution,
  tallyBy,
  type AnalyticsStudent,
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
