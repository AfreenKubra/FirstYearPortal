import { describe, expect, it } from "vitest";
import {
  daysBetween,
  describeCountdown,
  examTrack,
  formatDayLabel,
  todayISO,
} from "../exam-track";

/**
 * The countdown a student plans around.
 *
 * The roadmap generator is forbidden from stating a date — `ai-generate.ts`
 * drops any milestone that does — so every date on the exam track panel comes
 * from an administrator-entered column and passes through this module. The
 * tests that matter most are therefore the ones about *absence*: a missing
 * date has to stay missing, and a partial set of dates has to produce a
 * partial track rather than a complete-looking one built on defaults.
 */

const TODAY = "2026-03-01";

describe("daysBetween", () => {
  it("counts forward", () => {
    expect(daysBetween("2026-03-01", "2026-03-15")).toBe(14);
  });

  it("counts backward as a negative", () => {
    expect(daysBetween("2026-03-15", "2026-03-01")).toBe(-14);
  });

  it("is zero for the same day", () => {
    expect(daysBetween(TODAY, TODAY)).toBe(0);
  });

  it("crosses a month and a leap day correctly", () => {
    expect(daysBetween("2028-02-27", "2028-03-01")).toBe(3);
  });

  it("returns null for a malformed date rather than a plausible number", () => {
    expect(daysBetween(TODAY, "next Tuesday")).toBeNull();
    expect(daysBetween(TODAY, "2026-3-1")).toBeNull();
  });

  it("rejects a date that does not exist", () => {
    // JS would roll 2026-02-31 forward to 3 March and answer confidently.
    expect(daysBetween(TODAY, "2026-02-31")).toBeNull();
  });
});

describe("examTrack — countdown", () => {
  it("counts the days to a future exam", () => {
    const track = examTrack(
      { occursOn: "2026-08-06", registrationOpensOn: null, registrationClosesOn: null },
      TODAY,
    );
    expect(track.daysUntilExam).toBe(158);
  });

  it("reports zero on the day itself", () => {
    const track = examTrack(
      { occursOn: TODAY, registrationOpensOn: null, registrationClosesOn: null },
      TODAY,
    );
    expect(track.daysUntilExam).toBe(0);
    expect(track.markers[0].reached).toBe(true);
  });

  it("goes negative once the exam has passed", () => {
    // The catalogue filter drops past exams before this is reached, but the
    // maths still has to be honest rather than clamping at zero — a clamped
    // "0 days" would read as "today".
    const track = examTrack(
      { occursOn: "2026-02-01", registrationOpensOn: null, registrationClosesOn: null },
      TODAY,
    );
    expect(track.daysUntilExam).toBe(-28);
  });

  it("returns null when no exam date is recorded", () => {
    const track = examTrack(
      {
        occursOn: null,
        registrationOpensOn: "2026-01-01",
        registrationClosesOn: "2026-02-01",
      },
      TODAY,
    );
    expect(track.daysUntilExam).toBeNull();
  });
});

describe("examTrack — registration state", () => {
  const withWindow = (opens: string | null, closes: string | null) =>
    examTrack(
      { occursOn: "2026-08-06", registrationOpensOn: opens, registrationClosesOn: closes },
      TODAY,
    );

  it("is open between the two recorded dates", () => {
    expect(withWindow("2026-02-01", "2026-04-01").registrationState).toBe("open");
  });

  it("is not-open before the recorded opening date", () => {
    expect(withWindow("2026-04-01", "2026-05-01").registrationState).toBe("not-open");
  });

  it("is closed after the recorded closing date", () => {
    expect(withWindow("2026-01-01", "2026-02-01").registrationState).toBe("closed");
  });

  it("is open on the opening day and on the closing day", () => {
    expect(withWindow(TODAY, "2026-04-01").registrationState).toBe("open");
    expect(withWindow("2026-01-01", TODAY).registrationState).toBe("open");
  });

  it("is unknown when no dates are recorded", () => {
    expect(withWindow(null, null).registrationState).toBe("unknown");
  });

  it("will not claim registration is open on a closing date alone", () => {
    // Without an opening date the portal genuinely does not know registration
    // has started. Inferring "open" from a closing date still ahead would
    // state something nobody entered.
    expect(withWindow(null, "2026-04-01").registrationState).toBe("unknown");
  });

  it("still reports closed on a closing date alone, which is certain", () => {
    expect(withWindow(null, "2026-02-01").registrationState).toBe("closed");
  });

  it("counts the days to the closing date", () => {
    expect(withWindow("2026-01-01", "2026-03-03").daysUntilRegistrationCloses).toBe(2);
  });
});

describe("examTrack — markers", () => {
  it("omits markers for dates that were never recorded", () => {
    const track = examTrack(
      { occursOn: "2026-08-06", registrationOpensOn: null, registrationClosesOn: null },
      TODAY,
    );
    expect(track.markers.map((m) => m.key)).toEqual(["exam"]);
  });

  it("orders markers opens → closes → exam", () => {
    const track = examTrack(
      {
        occursOn: "2026-08-06",
        registrationOpensOn: "2026-02-01",
        registrationClosesOn: "2026-04-01",
      },
      TODAY,
    );
    expect(track.markers.map((m) => m.key)).toEqual(["opens", "closes", "exam"]);
  });

  it("marks only the points already behind us as reached", () => {
    const track = examTrack(
      {
        occursOn: "2026-08-06",
        registrationOpensOn: "2026-02-01",
        registrationClosesOn: "2026-04-01",
      },
      TODAY,
    );
    expect(track.markers.map((m) => m.reached)).toEqual([true, false, false]);
  });

  it("reports an empty track when nothing at all is recorded", () => {
    const track = examTrack(
      { occursOn: null, registrationOpensOn: null, registrationClosesOn: null },
      TODAY,
    );
    expect(track.isEmpty).toBe(true);
    expect(track.markers).toEqual([]);
    expect(track.elapsedPercent).toBeNull();
  });
});

describe("examTrack — elapsed span", () => {
  it("measures progress across the recorded window", () => {
    const track = examTrack(
      {
        occursOn: "2026-05-01",
        registrationOpensOn: "2026-01-01",
        registrationClosesOn: null,
      },
      TODAY,
    );
    // 59 of 120 days.
    expect(track.elapsedPercent).toBe(49);
  });

  it("returns null with only one recorded date", () => {
    // A single date is a point. A bar drawn across a point would show a
    // duration nobody entered.
    const track = examTrack(
      { occursOn: "2026-08-06", registrationOpensOn: null, registrationClosesOn: null },
      TODAY,
    );
    expect(track.elapsedPercent).toBeNull();
  });

  it("clamps to 0 and 100 rather than running off the bar", () => {
    const before = examTrack(
      {
        occursOn: "2027-01-01",
        registrationOpensOn: "2026-06-01",
        registrationClosesOn: null,
      },
      TODAY,
    );
    const after = examTrack(
      {
        occursOn: "2026-02-01",
        registrationOpensOn: "2026-01-01",
        registrationClosesOn: null,
      },
      TODAY,
    );
    expect(before.elapsedPercent).toBe(0);
    expect(after.elapsedPercent).toBe(100);
  });
});

describe("describeCountdown", () => {
  it("names today, tomorrow and yesterday rather than counting them", () => {
    expect(describeCountdown(0)).toBe("today");
    expect(describeCountdown(1)).toBe("tomorrow");
    expect(describeCountdown(-1)).toBe("yesterday");
  });

  it("counts forward and back", () => {
    expect(describeCountdown(158)).toBe("in 158 days");
    expect(describeCountdown(-3)).toBe("3 days ago");
  });

  it("says nothing at all when there is no date", () => {
    expect(describeCountdown(null)).toBeNull();
  });
});

describe("formatDayLabel", () => {
  it("returns null for a missing date instead of a placeholder", () => {
    expect(formatDayLabel(null)).toBeNull();
    expect(formatDayLabel("")).toBeNull();
  });

  it("returns null rather than guessing at a malformed date", () => {
    expect(formatDayLabel("06/08/2026")).toBeNull();
    expect(formatDayLabel("2026-02-31")).toBeNull();
  });

  it("renders the day that was stored, not the day before", () => {
    // `new Date("2026-08-06")` is UTC midnight, which prints as 5 August for
    // any reader west of Greenwich. The label is built from the parts instead.
    expect(formatDayLabel("2026-08-06")).toContain("6");
    expect(formatDayLabel("2026-08-06")).toContain("2026");
  });
});

describe("todayISO", () => {
  it("formats a local date without shifting it through UTC", () => {
    // 1 January, just after midnight local time. `toISOString().slice(0,10)`
    // would answer "2025-12-31" anywhere east of Greenwich.
    const justAfterMidnight = new Date(2026, 0, 1, 0, 30);
    expect(todayISO(justAfterMidnight)).toBe("2026-01-01");
  });

  it("pads single-digit months and days", () => {
    expect(todayISO(new Date(2026, 2, 5, 12))).toBe("2026-03-05");
  });
});
