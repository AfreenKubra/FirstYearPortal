/**
 * A student's class attendance, overall and per subject.
 *
 * Pure, so the arithmetic a student reads as a statement about their SEE
 * eligibility is tested without a database near it.
 */

/**
 * VTU's minimum attendance in each course to be eligible for its Semester
 * End Examination. Per course, not overall — a healthy overall figure does
 * not rescue one subject below the line, which is why each subject is
 * checked on its own.
 */
export const VTU_MIN_ATTENDANCE = 85;

export type SubjectAttendanceInput = {
  subjectId: string;
  code: string;
  name: string;
  held: number;
  attended: number;
};

export type SubjectAttendance = SubjectAttendanceInput & {
  percent: number;
  belowMinimum: boolean;
};

export type AttendanceSummary = {
  /** null until at least one subject has attendance recorded. */
  overall: { held: number; attended: number; percent: number; belowMinimum: boolean } | null;
  subjects: SubjectAttendance[];
  belowMinimumCount: number;
};

/**
 * Rounded *down* to one decimal. Rounding to nearest would show 84.97% as
 * "85.0%" next to a "below 85%" warning — the displayed figure and the
 * verdict beside it have to agree.
 */
export function attendancePercent(attended: number, held: number): number {
  if (held <= 0) return 0;
  return Math.floor((attended * 1000) / held) / 10;
}

/** Exact, in integers: no float can nudge a borderline student either way. */
export function isBelowMinimum(attended: number, held: number): boolean {
  return attended * 100 < held * VTU_MIN_ATTENDANCE;
}

export function summariseAttendance(
  rows: readonly SubjectAttendanceInput[],
): AttendanceSummary {
  const subjects = rows
    .filter((r) => r.held > 0)
    .map((r) => ({
      ...r,
      percent: attendancePercent(r.attended, r.held),
      belowMinimum: isBelowMinimum(r.attended, r.held),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  if (subjects.length === 0) {
    return { overall: null, subjects: [], belowMinimumCount: 0 };
  }

  // Total attended over total held — not the mean of subject percentages,
  // which would weight a 12-class subject the same as a 50-class one.
  const held = subjects.reduce((s, r) => s + r.held, 0);
  const attended = subjects.reduce((s, r) => s + r.attended, 0);

  return {
    overall: {
      held,
      attended,
      percent: attendancePercent(attended, held),
      belowMinimum: isBelowMinimum(attended, held),
    },
    subjects,
    belowMinimumCount: subjects.filter((s) => s.belowMinimum).length,
  };
}
