/**
 * Pure calendar math: what's upcoming, what's past, how many days remain.
 *
 * Every date here is a plain `YYYY-MM-DD` string, compared and diffed as UTC
 * midnight rather than parsed with the local-timezone `Date` constructor —
 * the same discipline `exam-track.ts` uses, for the same reason: a college
 * two timezones away from the reader must not have its holidays shift by a
 * day. Free of `server-only`, so this can be tested without a database.
 */

import type { CalendarEventCategory } from "@/config/calendar";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  category: CalendarEventCategory;
  /** `YYYY-MM-DD`. */
  startsOn: string;
  /** `YYYY-MM-DD`, or null for a single-day event. */
  endsOn: string | null;
  href: string;
  /** Flagged by an admin for the dashboard's "Important Academic Dates" widget. */
  isKeyDate: boolean;
};

function toUtcDays(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Whole days from `todayIso` to `dateIso` — negative when `dateIso` is past. */
export function daysUntil(dateIso: string, todayIso: string): number {
  return toUtcDays(dateIso) - toUtcDays(todayIso);
}

/**
 * An event has passed once its last day (the end of its range, or its own
 * day for a single-day event) is before today. A multi-day event is not
 * "past" until its final day has gone by.
 */
export function isPast(event: CalendarEvent, todayIso: string): boolean {
  const lastDay = event.endsOn ?? event.startsOn;
  return toUtcDays(lastDay) < toUtcDays(todayIso);
}

export function isOngoing(event: CalendarEvent, todayIso: string): boolean {
  const today = toUtcDays(todayIso);
  const start = toUtcDays(event.startsOn);
  const end = toUtcDays(event.endsOn ?? event.startsOn);
  return today >= start && today <= end;
}

/** Not-yet-past events, soonest first, capped to `limit`. */
export function upcoming(
  events: readonly CalendarEvent[],
  todayIso: string,
  limit?: number,
): CalendarEvent[] {
  const sorted = events
    .filter((e) => !isPast(e, todayIso))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

/**
 * `null` categories means "all events" (the "All Events" filter chip) — kept
 * as a distinct case rather than "every category listed" so a newly added
 * category is included automatically instead of silently hidden until the
 * filter list is updated to name it.
 */
export function byCategory(
  events: readonly CalendarEvent[],
  categories: readonly CalendarEventCategory[] | null,
): CalendarEvent[] {
  if (categories === null) return [...events];
  const allowed = new Set(categories);
  return events.filter((e) => allowed.has(e.category));
}

/**
 * The exam-category rows that are windows rather than single days — a real
 * multi-day examination period, distinguished structurally (it carries an
 * `endsOn`) rather than by matching on words like "Examination" in the
 * title, which would stop working the day a title was phrased differently.
 */
export function examWindows(
  events: readonly CalendarEvent[],
  todayIso: string,
): CalendarEvent[] {
  return upcoming(
    events.filter((e) => e.category === "exam" && e.endsOn !== null),
    todayIso,
  );
}

/** Events grouped by day, for the agenda view. Keys are `YYYY-MM-DD`. */
export function groupByDate(
  events: readonly CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    map.set(event.startsOn, [...(map.get(event.startsOn) ?? []), event]);
  }
  return map;
}
