import { describe, expect, it } from "vitest";
import {
  byCategory,
  daysUntil,
  examWindows,
  groupByDate,
  isOngoing,
  isPast,
  saturdayNote,
  saturdayOfMonth,
  upcoming,
  type CalendarEvent,
} from "../schedule";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_FILTERS,
  categoryMeta,
  isExamCategory,
} from "@/config/calendar";

/**
 * Calendar date math is where an off-by-one silently mislabels an exam as
 * "today" a day early or drops a multi-day event the moment it starts — so
 * the assertions here are about the boundaries: the last day of a range, the
 * exact day something starts, and the UTC-vs-local trap `exam-track.test.ts`
 * already guards against for the roadmap's dates.
 */

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "1",
  title: "Test event",
  description: null,
  category: "academic",
  startsOn: "2026-10-28",
  endsOn: null,
  href: "/calendar",
  isKeyDate: false,
  ...over,
});

describe("daysUntil", () => {
  it("is 0 for today", () => {
    expect(daysUntil("2026-09-03", "2026-09-03")).toBe(0);
  });

  it("is positive for a future date", () => {
    expect(daysUntil("2026-09-10", "2026-09-03")).toBe(7);
  });

  it("is negative for a past date", () => {
    expect(daysUntil("2026-08-27", "2026-09-03")).toBe(-7);
  });

  it("crosses a month boundary correctly", () => {
    expect(daysUntil("2026-10-01", "2026-09-29")).toBe(2);
  });
});

describe("isPast", () => {
  it("is false for a single-day event today", () => {
    expect(isPast(event({ startsOn: "2026-09-03" }), "2026-09-03")).toBe(false);
  });

  it("is true the day after a single-day event", () => {
    expect(isPast(event({ startsOn: "2026-09-02" }), "2026-09-03")).toBe(true);
  });

  it("uses the end date, not the start date, for a range", () => {
    const ranged = event({ startsOn: "2026-10-28", endsOn: "2026-10-31" });
    expect(isPast(ranged, "2026-10-30")).toBe(false);
    expect(isPast(ranged, "2026-11-01")).toBe(true);
  });
});

describe("isOngoing", () => {
  it("is true on the first and last day of a range", () => {
    const ranged = event({ startsOn: "2026-10-28", endsOn: "2026-10-31" });
    expect(isOngoing(ranged, "2026-10-28")).toBe(true);
    expect(isOngoing(ranged, "2026-10-31")).toBe(true);
  });

  it("is false the day before it starts", () => {
    const ranged = event({ startsOn: "2026-10-28", endsOn: "2026-10-31" });
    expect(isOngoing(ranged, "2026-10-27")).toBe(false);
  });
});

describe("upcoming", () => {
  it("excludes past events and sorts soonest first", () => {
    const events = [
      event({ id: "a", startsOn: "2026-09-10" }),
      event({ id: "b", startsOn: "2026-08-01" }), // past
      event({ id: "c", startsOn: "2026-09-05" }),
    ];
    expect(upcoming(events, "2026-09-03").map((e) => e.id)).toEqual(["c", "a"]);
  });

  it("respects a limit", () => {
    const events = [
      event({ id: "a", startsOn: "2026-09-05" }),
      event({ id: "b", startsOn: "2026-09-06" }),
      event({ id: "c", startsOn: "2026-09-07" }),
    ];
    expect(upcoming(events, "2026-09-03", 2).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("keeps a range event until its last day has passed", () => {
    const ranged = event({ startsOn: "2026-09-01", endsOn: "2026-09-05" });
    expect(upcoming([ranged], "2026-09-04")).toHaveLength(1);
    expect(upcoming([ranged], "2026-09-06")).toHaveLength(0);
  });
});

describe("byCategory", () => {
  const events = [
    event({ id: "a", category: "holiday" }),
    event({ id: "b", category: "exam" }),
    event({ id: "c", category: "timetable" }),
  ];

  it("returns everything for null (All Events)", () => {
    expect(byCategory(events, null)).toHaveLength(3);
  });

  it("filters to exactly the requested categories", () => {
    expect(byCategory(events, ["exam"]).map((e) => e.id)).toEqual(["b"]);
  });

  it("combines several categories under one filter chip", () => {
    expect(
      byCategory(events, ["academic", "timetable"]).map((e) => e.id),
    ).toEqual(["c"]);
  });
});

describe("examWindows", () => {
  it("keeps only exam-category rows with an end date", () => {
    const events = [
      event({ id: "window", category: "exam", startsOn: "2027-01-04", endsOn: "2027-02-05" }),
      event({ id: "single-day", category: "exam", startsOn: "2026-10-23", endsOn: null }),
      event({ id: "holiday-range", category: "holiday", startsOn: "2026-10-02", endsOn: "2026-10-04" }),
    ];
    expect(examWindows(events, "2026-09-03").map((e) => e.id)).toEqual(["window"]);
  });

  it("drops a window once it has fully passed", () => {
    const past = event({ category: "exam", startsOn: "2026-08-01", endsOn: "2026-08-05" });
    expect(examWindows([past], "2026-09-03")).toEqual([]);
  });

  it("includes CIE and SEE windows, not just the generic exam category", () => {
    // IA tests moved to `cie` and semester-end exams to `see` (0044). A check
    // on `category === "exam"` alone would have dropped every one of them
    // from "Upcoming examinations" without an error.
    const events = [
      event({ id: "ia", category: "cie", startsOn: "2026-10-28", endsOn: "2026-10-30" }),
      event({ id: "finals", category: "see", startsOn: "2027-01-04", endsOn: "2027-02-05" }),
      event({ id: "gate", category: "exam", startsOn: "2027-02-06", endsOn: "2027-02-14" }),
    ];
    expect(examWindows(events, "2026-09-03").map((e) => e.id)).toEqual([
      "ia",
      "finals",
      "gate",
    ]);
  });
});

describe("saturdayOfMonth", () => {
  it("names which Saturday of the month a date is", () => {
    // The timetable swaps on the real 2026 calendar.
    expect(saturdayOfMonth("2026-09-12")).toBe("2nd Saturday"); // Monday Timetable
    expect(saturdayOfMonth("2026-09-26")).toBe("4th Saturday"); // Tuesday Timetable
    expect(saturdayOfMonth("2026-10-24")).toBe("4th Saturday"); // Wednesday Timetable
    expect(saturdayOfMonth("2026-11-14")).toBe("2nd Saturday"); // Thursday Timetable
  });

  it("covers a fifth Saturday", () => {
    expect(saturdayOfMonth("2026-10-31")).toBe("5th Saturday");
  });

  it("returns null for any other day", () => {
    expect(saturdayOfMonth("2026-09-08")).toBeNull(); // Tuesday
    expect(saturdayOfMonth("2026-09-13")).toBeNull(); // Sunday
  });

  it("does not repeat it when the title already says it", () => {
    expect(
      saturdayNote(event({ title: "3rd Saturday", category: "holiday", startsOn: "2026-09-19" })),
    ).toBeNull();
    expect(
      saturdayNote(event({ title: "Tuesday Timetable", category: "timetable", startsOn: "2026-09-26" })),
    ).toBe("4th Saturday");
  });
});

describe("calendar categories", () => {
  it("counts CIE, SEE and other exams as examinations, and nothing else", () => {
    expect(isExamCategory("cie")).toBe(true);
    expect(isExamCategory("see")).toBe(true);
    expect(isExamCategory("exam")).toBe(true);
    for (const other of ["holiday", "ptm", "academic", "deadline", "timetable"] as const) {
      expect(isExamCategory(other), other).toBe(false);
    }
  });

  it("offers CIE and SEE as filter chips of their own", () => {
    const labels = CALENDAR_FILTERS.map((f) => f.label);
    expect(labels).toContain("CIE");
    expect(labels).toContain("SEE");
  });

  it("gives every category a chip, so none is unreachable by filtering", () => {
    const covered = new Set(CALENDAR_FILTERS.flatMap((f) => f.categories ?? []));
    for (const category of CALENDAR_CATEGORIES) {
      expect(covered.has(category.value), category.value).toBe(true);
    }
  });

  it("falls back to Academic, found by value rather than array position", () => {
    // It used to be `CALENDAR_CATEGORIES[3]`, which inserting CIE and SEE
    // would have quietly turned into "Other Examination".
    expect(categoryMeta("nonsense" as never).value).toBe("academic");
  });
});

describe("groupByDate", () => {
  it("groups same-day events together", () => {
    const events = [
      event({ id: "a", startsOn: "2026-10-28" }),
      event({ id: "b", startsOn: "2026-10-28" }),
      event({ id: "c", startsOn: "2026-10-29" }),
    ];
    const grouped = groupByDate(events);
    expect(grouped.get("2026-10-28")).toHaveLength(2);
    expect(grouped.get("2026-10-29")).toHaveLength(1);
  });
});
