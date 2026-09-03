import { describe, expect, it } from "vitest";
import {
  byCategory,
  daysUntil,
  examWindows,
  groupByDate,
  isOngoing,
  isPast,
  upcoming,
  type CalendarEvent,
} from "../schedule";

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
