/**
 * Date arithmetic for the exam track panel (PRD 5.9, roadmap).
 *
 * Pure, and deliberately so. Every number this file produces is rendered next
 * to the words "exam" and "registration closes", which is exactly the kind of
 * claim the roadmap's "invents nothing" rule exists to protect: the AI
 * generator drops any milestone that states a date, precisely so that the only
 * dates a student ever sees are ones an administrator typed into
 * `resources.occurs_on` / `registration_opens_on` / `registration_closes_on`.
 *
 * So this module computes *only* differences between a stored date and today.
 * It never fills a missing date, never infers one from another, and returns
 * `null` wherever it does not know — the panel is built to render around a
 * missing date rather than substitute a plausible one.
 *
 * Everything works on `YYYY-MM-DD` strings, matching the `date` columns added
 * in migration 0023. Those columns are calendar days, not instants: an exam is
 * "the 14th of February", not a timestamp, and carrying a timezone through
 * here would invent a time of day nobody recorded.
 */

export type ExamDates = {
  occursOn: string | null;
  registrationOpensOn: string | null;
  registrationClosesOn: string | null;
};

/**
 * Where registration stands *given what is recorded*.
 *
 * `unknown` is a real answer, not a fallback. With no opening date stored we
 * genuinely cannot say registration has opened, and guessing "open" because
 * the closing date is still ahead would state something nobody checked.
 */
export type RegistrationState = "not-open" | "open" | "closed" | "unknown";

export type TrackMarker = {
  key: "opens" | "closes" | "exam";
  /** `YYYY-MM-DD`. Markers for unrecorded dates are omitted, not faked. */
  date: string;
  /** Whether this point is already behind us. */
  reached: boolean;
};

export type ExamTrack = {
  /** Negative once the exam is behind us. Null when no date is recorded. */
  daysUntilExam: number | null;
  daysUntilRegistrationCloses: number | null;
  registrationState: RegistrationState;
  /**
   * How far along the recorded window we are, 0–100, for the progress bar.
   * Null when there is no measurable span — a single date is a point, and a
   * bar drawn across a point would imply a duration that was never recorded.
   */
  elapsedPercent: number | null;
  markers: TrackMarker[];
  /** True when nothing at all is recorded, so the caller can say so plainly. */
  isEmpty: boolean;
};

const DAY_MS = 86_400_000;

/** Strict `YYYY-MM-DD`; anything else is treated as unrecorded. */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Days as a UTC epoch, purely so subtraction is exact.
 *
 * Using UTC here is not a timezone claim about the exam — it is the opposite.
 * Parsing both operands the same way makes the difference immune to daylight
 * saving, where a local-time subtraction across a transition yields 157.96
 * days and rounds to the wrong integer.
 */
function toUtcDay(iso: string): number | null {
  const match = ISO_DAY.exec(iso);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);

  // Rejects 2026-02-31 and friends, which JS would silently roll forward.
  const round = new Date(ms);
  if (
    round.getUTCFullYear() !== year ||
    round.getUTCMonth() !== month - 1 ||
    round.getUTCDate() !== day
  ) {
    return null;
  }

  return ms;
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number | null {
  const a = toUtcDay(from);
  const b = toUtcDay(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

/** Today as `YYYY-MM-DD` in the reader's own timezone. */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The countdown, the state, and the markers — from stored dates only.
 *
 * Any of the three dates may be missing, and the shape of the result changes
 * accordingly rather than degrading into zeroes. A resource with an exam date
 * and no registration window still produces a usable countdown; one with a
 * registration window and no exam date still produces a usable deadline.
 */
export function examTrack(
  dates: ExamDates,
  today: string = todayISO(),
): ExamTrack {
  const opens = dates.registrationOpensOn;
  const closes = dates.registrationClosesOn;
  const exam = dates.occursOn;

  const daysUntilExam = exam ? daysBetween(today, exam) : null;
  const daysUntilRegistrationCloses = closes ? daysBetween(today, closes) : null;
  const daysSinceOpen = opens ? daysBetween(today, opens) : null;

  let registrationState: RegistrationState = "unknown";
  if (daysUntilRegistrationCloses !== null && daysUntilRegistrationCloses < 0) {
    // Certain: the recorded closing day is behind us.
    registrationState = "closed";
  } else if (daysSinceOpen !== null && daysSinceOpen > 0) {
    // Certain: the recorded opening day is still ahead.
    registrationState = "not-open";
  } else if (daysSinceOpen !== null) {
    // Opening day recorded and reached, closing day either absent or ahead.
    registrationState = "open";
  }

  const markers: TrackMarker[] = [];
  if (opens && toUtcDay(opens) !== null) {
    markers.push({
      key: "opens",
      date: opens,
      reached: (daysSinceOpen ?? 1) <= 0,
    });
  }
  if (closes && toUtcDay(closes) !== null) {
    markers.push({
      key: "closes",
      date: closes,
      reached: (daysUntilRegistrationCloses ?? 1) < 0,
    });
  }
  if (exam && toUtcDay(exam) !== null) {
    markers.push({
      key: "exam",
      date: exam,
      reached: (daysUntilExam ?? 1) <= 0,
    });
  }

  return {
    daysUntilExam,
    daysUntilRegistrationCloses,
    registrationState,
    elapsedPercent: elapsedPercent(markers, today),
    markers,
    isEmpty: markers.length === 0,
  };
}

/**
 * Progress across the span the recorded dates actually cover.
 *
 * Measured between the first and last *recorded* marker, never between a
 * recorded one and an assumed one. With a single marker there is no span, and
 * the bar is suppressed rather than drawn at some arbitrary fraction.
 */
function elapsedPercent(markers: TrackMarker[], today: string): number | null {
  if (markers.length < 2) return null;

  const start = toUtcDay(markers[0].date);
  const end = toUtcDay(markers[markers.length - 1].date);
  const now = toUtcDay(today);
  if (start === null || end === null || now === null) return null;
  if (end <= start) return null;

  const fraction = (now - start) / (end - start);
  return Math.max(0, Math.min(100, Math.round(fraction * 100)));
}

/**
 * "in 158 days" / "today" / "3 days ago" — plain English for a day count.
 *
 * Separate from `examTrack` so the maths can be tested without asserting on
 * prose, and so a caller that wants the raw number is not forced through a
 * string.
 */
export function describeCountdown(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/**
 * A stored `YYYY-MM-DD` rendered for a reader.
 *
 * Built from the parts rather than `new Date(iso)`, because that constructor
 * reads a bare date string as UTC midnight — which, west of Greenwich, prints
 * the day before the one an administrator typed.
 */
export function formatDayLabel(iso: string | null): string | null {
  if (!iso) return null;
  const match = ISO_DAY.exec(iso);
  if (!match || toUtcDay(iso) === null) return null;

  const local = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return local.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const MARKER_LABELS: Record<TrackMarker["key"], string> = {
  opens: "Registration opens",
  closes: "Registration closes",
  exam: "Exam day",
};
