import { describe, expect, it } from "vitest";
import {
  attendancePercent,
  isBelowMinimum,
  summariseAttendance,
} from "../summary";

const subject = (code: string, held: number, attended: number) => ({
  subjectId: code,
  code,
  name: code,
  held,
  attended,
});

describe("attendancePercent", () => {
  it("rounds down to one decimal", () => {
    expect(attendancePercent(39, 42)).toBe(92.8); // 92.857…
    expect(attendancePercent(42, 42)).toBe(100);
  });

  it("never shows 85.0% for a student who is below 85%", () => {
    // 84.97% rounded to nearest would read 85.0% beside a "below" warning.
    const attended = 8497;
    const held = 10000;
    expect(attendancePercent(attended, held)).toBe(84.9);
    expect(isBelowMinimum(attended, held)).toBe(true);
  });

  it("returns 0 rather than dividing by zero", () => {
    expect(attendancePercent(0, 0)).toBe(0);
  });
});

describe("isBelowMinimum", () => {
  it("treats exactly 85% as meeting the minimum", () => {
    expect(isBelowMinimum(85, 100)).toBe(false);
    expect(isBelowMinimum(34, 40)).toBe(false); // exactly 85%
    expect(isBelowMinimum(33, 40)).toBe(true); // 82.5%
  });
});

describe("summariseAttendance", () => {
  it("reports nothing until some attendance is recorded", () => {
    expect(summariseAttendance([])).toEqual({
      overall: null,
      subjects: [],
      belowMinimumCount: 0,
    });
  });

  it("computes overall from total classes, not the mean of percentages", () => {
    // 10/12 (83.3%) and 50/50 (100%): mean of percentages is 91.7%, but the
    // student attended 60 of 62 classes — 96.7%.
    const summary = summariseAttendance([subject("A", 12, 10), subject("B", 50, 50)]);
    expect(summary.overall).toEqual({
      held: 62,
      attended: 60,
      percent: 96.7,
      belowMinimum: false,
    });
  });

  it("flags each subject below the minimum even when overall is fine", () => {
    // VTU's rule is per course: a good overall does not rescue one subject.
    const summary = summariseAttendance([subject("A", 12, 10), subject("B", 50, 50)]);
    expect(summary.overall?.belowMinimum).toBe(false);
    expect(summary.subjects.find((s) => s.code === "A")?.belowMinimum).toBe(true);
    expect(summary.belowMinimumCount).toBe(1);
  });

  it("ignores a subject with no classes held yet", () => {
    const summary = summariseAttendance([subject("A", 0, 0), subject("B", 40, 38)]);
    expect(summary.subjects.map((s) => s.code)).toEqual(["B"]);
  });

  it("lists subjects in code order", () => {
    const summary = summariseAttendance([subject("C", 10, 10), subject("A", 10, 10)]);
    expect(summary.subjects.map((s) => s.code)).toEqual(["A", "C"]);
  });
});
