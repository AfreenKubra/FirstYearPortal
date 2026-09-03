/**
 * Institution analytics (PRD 5.6).
 *
 * Pure functions over already-fetched rows. Kept out of the query layer so
 * the aggregation can be unit-tested against fixtures — the arithmetic behind
 * a completion rate or a department comparison is exactly the kind of thing
 * that silently goes wrong and gets reported to a principal as fact.
 */

export type AnalyticsStudent = {
  id: string;
  departmentCode: string;
  semester: number | null;
  section: string | null;
  quota: string | null;
  residenceType: string | null;
  tenthPercentage: number | null;
  twelfthPercentage: number | null;
  completionPercent: number;
};

export type Slice = { label: string; count: number };

export const QUOTA_LABELS: Record<string, string> = {
  cet: "KCET",
  comedk: "COMEDK",
  jee: "JEE / Central",
  management: "Management",
  diploma_lateral: "Diploma lateral",
  other: "Other",
};

import { residenceLabel } from "@/config/residence";

export { RESIDENCE_LABELS, residenceLabel } from "@/config/residence";

/** Counts by key, most common first; nulls collected under "Not set". */
export function tallyBy<T>(
  rows: T[],
  pick: (row: T) => string | null | undefined,
): Slice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row) ?? "Not set";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Mean of the values that exist.
 *
 * Missing values are skipped rather than counted as zero — treating an
 * unfilled 12th percentage as 0 would drag a department average down and
 * make an incomplete cohort look like a failing one.
 */
export function averageOf(values: Array<number | null | undefined>): number | null {
  const present = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (present.length === 0) return null;
  const sum = present.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / present.length) * 100) / 100;
}

export function completionRate(rows: AnalyticsStudent[]): number {
  if (rows.length === 0) return 0;
  const complete = rows.filter((r) => r.completionPercent === 100).length;
  return Math.round((complete / rows.length) * 100);
}

export type DepartmentSummary = {
  code: string;
  name: string;
  total: number;
  complete: number;
  incomplete: number;
  completionRate: number;
  avgTenth: number | null;
  avgTwelfth: number | null;
  /** Anyone not living at their family home — hostel, PG, or rented flat. */
  livingAway: number;
  livingAtHome: number;
};

/**
 * Side-by-side department comparison (PRD 5.6).
 *
 * Every known department appears, including ones with no students yet — a
 * department silently missing from a comparison table reads as "no data
 * collected", which is a different claim from "no students enrolled".
 */
export function summariseDepartments(
  rows: AnalyticsStudent[],
  departments: Array<{ code: string; name: string }>,
): DepartmentSummary[] {
  return departments
    .map((dept) => {
      const members = rows.filter((r) => r.departmentCode === dept.code);
      const complete = members.filter((r) => r.completionPercent === 100).length;

      return {
        code: dept.code,
        name: dept.name,
        total: members.length,
        complete,
        incomplete: members.length - complete,
        completionRate: completionRate(members),
        avgTenth: averageOf(members.map((r) => r.tenthPercentage)),
        avgTwelfth: averageOf(members.map((r) => r.twelfthPercentage)),
        // Grouped rather than reported per-option: what a department actually
        // acts on is how many students are away from home and may need
        // pastoral support, not the hostel/PG/flat split.
        livingAway: members.filter(
          (r) =>
            r.residenceType !== null &&
            r.residenceType !== undefined &&
            r.residenceType !== "home",
        ).length,
        livingAtHome: members.filter((r) => r.residenceType === "home").length,
      };
    })
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
}

export type InstitutionStats = {
  totalStudents: number;
  complete: number;
  incomplete: number;
  completionRate: number;
  avgTenth: number | null;
  avgTwelfth: number | null;
  byDepartment: Slice[];
  bySemester: Slice[];
  byQuota: Slice[];
  byResidence: Slice[];
  byState: Slice[];
};

/**
 * Generic over the row type so a caller carrying extra columns (home state,
 * for instance) can read them in `stateOf` without the extras being widened
 * away at the call site.
 */
export function summariseInstitution<T extends AnalyticsStudent>(
  rows: T[],
  stateOf: (row: T) => string | null = () => null,
): InstitutionStats {
  const complete = rows.filter((r) => r.completionPercent === 100).length;

  return {
    totalStudents: rows.length,
    complete,
    incomplete: rows.length - complete,
    completionRate: completionRate(rows),
    avgTenth: averageOf(rows.map((r) => r.tenthPercentage)),
    avgTwelfth: averageOf(rows.map((r) => r.twelfthPercentage)),
    byDepartment: tallyBy(rows, (r) => r.departmentCode),
    bySemester: tallyBy(rows, (r) =>
      r.semester ? `Semester ${r.semester}` : null,
    ),
    byQuota: tallyBy(rows, (r) =>
      r.quota ? QUOTA_LABELS[r.quota] ?? r.quota : null,
    ),
    byResidence: tallyBy(rows, (r) =>
      r.residenceType ? residenceLabel(r.residenceType) : null,
    ),
    byState: tallyBy(rows, stateOf),
  };
}

// --- Internal marks (migration 0025) ----------------------------------------

/** One recorded mark, flattened with the student's department. */
export type AnalyticsMarkRow = {
  studentId: string;
  departmentCode: string;
  componentCode: string;
  marks: number | null;
  maxMarks: number;
  released: boolean;
};

export type ComponentSummary = {
  code: string;
  label: string;
  maxMarks: number;
  /** Rows carrying a mark. */
  recorded: number;
  /** Of those, how many students can see. */
  released: number;
  /**
   * Mean of the recorded marks as a percentage of that component's maximum.
   *
   * A percentage rather than a raw mean because the components have different
   * maxima — a raw "average mark" pooled across a 20-mark IA and a 10-mark
   * activity is a number with no meaning. Null when nothing is recorded.
   */
  averagePercent: number | null;
};

export type MarksAnalytics = {
  studentsWithMarks: number;
  entriesRecorded: number;
  entriesReleased: number;
  byComponent: ComponentSummary[];
  /** Students carrying at least one mark, per department. */
  markedByDepartment: Slice[];
};

/**
 * Institution-wide marks coverage (PRD 5.6 applied to migration 0025).
 *
 * What this deliberately does NOT produce is a single "average marks" figure
 * or anything resembling a CIE. VTU's formula varies by scheme and subject
 * kind, and pooling components with different maxima would invent an
 * authoritative-looking number nobody entered — the same mistake the roadmap
 * generator and the CSV exports are built to avoid. The honest questions at
 * this level are how much marking has happened, how much of it students can
 * see, and how each component is landing relative to its own maximum.
 *
 * Unmarked entries are skipped rather than counted as zero, matching
 * `averageOf` above and the blank-is-not-a-zero rule the screens follow: an
 * unmarked cohort must not read as a failing one.
 */
export function summariseMarks(
  rows: AnalyticsMarkRow[],
  components: Array<{ code: string; label: string; maxMarks: number }>,
): MarksAnalytics {
  const recorded = rows.filter((r) => r.marks !== null);

  const byComponent = components.map((component) => {
    const mine = recorded.filter((r) => r.componentCode === component.code);

    return {
      code: component.code,
      label: component.label,
      maxMarks: component.maxMarks,
      recorded: mine.length,
      released: mine.filter((r) => r.released).length,
      // Normalised per row against that row's own snapshotted maximum, not
      // the component's current one — a component whose maximum was changed
      // after marking would otherwise re-scale old figures.
      averagePercent: averageOf(
        mine.map((r) => (r.maxMarks > 0 ? (r.marks! / r.maxMarks) * 100 : null)),
      ),
    };
  });

  const studentsWithMarks = new Set(recorded.map((r) => r.studentId));

  // One entry per student, not per mark, so a student with four components
  // does not count four times toward their department.
  const perStudentDepartment = new Map<string, string>();
  for (const row of recorded) {
    perStudentDepartment.set(row.studentId, row.departmentCode);
  }

  return {
    studentsWithMarks: studentsWithMarks.size,
    entriesRecorded: recorded.length,
    entriesReleased: recorded.filter((r) => r.released).length,
    byComponent,
    markedByDepartment: tallyBy(
      [...perStudentDepartment.values()].map((departmentCode) => ({
        departmentCode,
      })),
      (r) => r.departmentCode,
    ),
  };
}

/**
 * Describes an assignment rule in the words an admin would use.
 * NULL scope columns mean "any", which reads badly if rendered literally.
 */
export function describeAssignment(assignment: {
  studentName?: string | null;
  departmentCode: string | null;
  semester: number | null;
  section: string | null;
  isMentor: boolean;
}): string {
  const role = assignment.isMentor ? "Mentor" : "Viewer";

  if (assignment.studentName) {
    return `${role} — ${assignment.studentName} (named student)`;
  }

  const parts: string[] = [assignment.departmentCode ?? "All departments"];
  parts.push(
    assignment.semester ? `Semester ${assignment.semester}` : "all semesters",
  );
  parts.push(assignment.section ? `Section ${assignment.section}` : "all sections");

  return `${role} — ${parts.join(" · ")}`;
}
