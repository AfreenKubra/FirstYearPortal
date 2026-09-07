import { describe, expect, it } from "vitest";
import { GOAL_TRACKS, goalTrackFor } from "../goal-tracks";

/**
 * This file is the reason no career goal shows a dead end any more, so the
 * assertions are about coverage and about the two rules the copy has to hold
 * to: official https sources only, and no dates or eligibility rules baked
 * into text that would go stale without anyone noticing.
 */

// The eight goals seeded in 0001_init_mvp.sql.
const SEEDED_GOALS = [
  "IT / Software employment",
  "Core (non-IT) engineering employment",
  "GATE / Higher studies in India",
  "Study abroad (MS / MEng)",
  "Entrepreneurship / Startup",
  "Government / PSU services",
  "Research & Academia",
  "Civil services",
];

describe("GOAL_TRACKS", () => {
  it("covers every seeded career goal, so none can fall through to an empty state", () => {
    for (const goal of SEEDED_GOALS) {
      expect(goalTrackFor(goal), `no track for "${goal}"`).not.toBeNull();
    }
    expect(GOAL_TRACKS).toHaveLength(SEEDED_GOALS.length);
  });

  it("gives every track something to actually do", () => {
    for (const track of GOAL_TRACKS) {
      expect(track.focus.length, track.goalName).toBeGreaterThan(0);
      expect(track.officialLinks.length, track.goalName).toBeGreaterThan(0);
      expect(track.heading.length, track.goalName).toBeGreaterThan(0);
    }
  });

  it("links only to https", () => {
    for (const track of GOAL_TRACKS) {
      for (const link of [...track.exams, ...track.officialLinks]) {
        expect(link.url, `${track.goalName} → ${link.label}`).toMatch(/^https:\/\//);
      }
    }
  });

  it("does not treat employment or startup goals as exam tracks", () => {
    // The whole point of the change: an IT student was being shown "no exam
    // track", which was true and useless.
    expect(goalTrackFor("IT / Software employment")?.exams).toEqual([]);
    expect(goalTrackFor("Entrepreneurship / Startup")?.exams).toEqual([]);
  });

  it("states no dates, fees, or eligibility rules — those go stale", () => {
    // The official page owns the specifics. Anything here that looked
    // authoritative would be read as current long after it stopped being so.
    const text = GOAL_TRACKS.flatMap((t) => [
      t.summary,
      ...t.focus,
      ...[...t.exams, ...t.officialLinks].map((l) => l.note),
    ]).join(" ");

    expect(text).not.toMatch(/\b(20\d\d|₹|\bRs\.?\b)/);
    expect(text).not.toMatch(/\b(deadline is|closes on|last date|cut ?off)\b/i);
  });

  it("returns null for a goal it does not know rather than guessing", () => {
    expect(goalTrackFor("Something else entirely")).toBeNull();
  });
});
