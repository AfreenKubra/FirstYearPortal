import "server-only";

import { createClient } from "@/lib/supabase/server";
import { pivotToComponents, releasedOnly, sumRecorded } from "@/lib/marks/compute";
import type { MarkComponent, MarkEntry } from "@/config/marks";

/**
 * Internal marks reads (migration 0025).
 *
 * Like `queries/directory.ts`, nothing here takes a role, a faculty id, or a
 * department: the staff grid is scoped by RLS through
 * `can_faculty_view_student()`, and a student's own card by the policy keyed
 * on `auth.uid()`. A faculty member and a head of department call the same
 * function and get their own students back.
 *
 * A missing migration degrades to an empty list rather than throwing, which is
 * the convention `check-schema.mjs` exists to compensate for.
 */

type ComponentRow = {
  code: string;
  label: string;
  max_marks: number;
  sort_order: number;
  is_active: boolean;
};

type MarkRow = {
  student_id: string;
  subject_id: string;
  component_code: string;
  marks: number | string | null;
  max_marks: number;
  remark: string | null;
  published_at: string | null;
};

/**
 * Normalises a `numeric` column to a JS number.
 *
 * The installed stack hands these back as numbers (verified against the live
 * database), but PostgREST is entitled to serialise `numeric` as a string —
 * JS numbers cannot represent every value the type can hold — and other
 * versions do. These are marks out of 20, so narrowing is safe either way;
 * accepting both is what stops a driver upgrade turning `17.5` into text that
 * sorts and sums wrongly rather than throwing.
 */
function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapEntry(row: MarkRow): MarkEntry {
  return {
    componentCode: row.component_code,
    marks: toNumber(row.marks),
    maxMarks: row.max_marks,
    remark: row.remark,
    publishedAt: row.published_at,
  };
}

/** The component definitions, in the order they should be shown. */
export async function listMarkComponents(): Promise<MarkComponent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("mark_components")
    .select("code, label, max_marks, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order")
    .order("code");

  return ((data ?? []) as ComponentRow[]).map((row) => ({
    code: row.code,
    label: row.label,
    maxMarks: row.max_marks,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));
}

// --- Staff side --------------------------------------------------------------

export type MarksGridStudent = {
  studentId: string;
  fullName: string;
  usn: string;
  section: string | null;
  /** One cell per component, in definition order. */
  cells: MarkEntry[];
};

export type MarksGrid = {
  components: MarkComponent[];
  students: MarksGridStudent[];
  /** Components with at least one row already released, so the UI can say so. */
  releasedComponents: string[];
};

/**
 * Everyone the caller may mark for one subject, with whatever is recorded.
 *
 * The roster comes from `student_directory` — the same RLS-scoped view the
 * student directory reads — narrowed to the subject's own department and
 * semester. A student in the right department but the wrong semester is not
 * sitting this paper, and a student the caller cannot see is not returned at
 * all, because the view will not yield them.
 */
export async function getMarksGrid(
  subjectId: string,
  section: string | null = null,
): Promise<MarksGrid | null> {
  const supabase = createClient();

  const { data: subject } = await supabase
    .from("vtu_subjects")
    .select("id, department_code, semester")
    .eq("id", subjectId)
    .single();

  if (!subject) return null;

  const components = await listMarkComponents();

  let rosterQuery = supabase
    .from("student_directory")
    .select("id, full_name, usn, section")
    .eq("department_code", subject.department_code)
    .eq("semester", subject.semester)
    .order("usn")
    .limit(500);

  if (section) rosterQuery = rosterQuery.eq("section", section);

  const { data: roster } = await rosterQuery;
  const rosterRows = (roster ?? []) as Array<{
    id: string;
    full_name: string;
    usn: string;
    section: string | null;
  }>;

  if (rosterRows.length === 0) {
    return { components, students: [], releasedComponents: [] };
  }

  const { data: markRows } = await supabase
    .from("student_subject_marks")
    .select(
      "student_id, subject_id, component_code, marks, max_marks, remark, published_at",
    )
    .eq("subject_id", subjectId)
    .in(
      "student_id",
      rosterRows.map((r) => r.id),
    );

  const byStudent = new Map<string, MarkEntry[]>();
  const released = new Set<string>();

  for (const row of (markRows ?? []) as MarkRow[]) {
    const entry = mapEntry(row);
    byStudent.set(row.student_id, [
      ...(byStudent.get(row.student_id) ?? []),
      entry,
    ]);
    if (entry.publishedAt !== null) released.add(entry.componentCode);
  }

  return {
    components,
    releasedComponents: [...released],
    students: rosterRows.map((row) => ({
      studentId: row.id,
      fullName: row.full_name,
      usn: row.usn,
      section: row.section,
      cells: pivotToComponents(components, byStudent.get(row.id) ?? []),
    })),
  };
}

/** Subjects a member of staff may mark against, for the picker. */
export async function listMarkableSubjects(departmentCode: string): Promise<
  Array<{ id: string; code: string; name: string; semester: number }>
> {
  const supabase = createClient();
  const { data } = await supabase
    .from("vtu_subjects")
    .select("id, code, name, semester, scheme_year")
    .eq("department_code", departmentCode)
    .eq("is_active", true)
    .order("semester")
    .order("scheme_year", { ascending: false })
    .order("code")
    .limit(300);

  return ((data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    semester: number;
  }>).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    semester: row.semester,
  }));
}

// --- Student side ------------------------------------------------------------

export type StudentSubjectMarks = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  cells: MarkEntry[];
  scored: number;
  outOf: number;
  recordedCount: number;
};

/**
 * The signed-in student's own card, one row per subject.
 *
 * RLS already withholds unreleased components, but `releasedOnly()` runs
 * anyway: this same function backs the staff preview of a student's card,
 * where the caller *can* read unreleased rows, and a total that silently
 * included them would show staff a figure the student cannot see.
 *
 * Subjects with nothing released at all are dropped rather than rendered
 * empty — a table of dashes tells a student nothing except that the portal
 * knows their timetable.
 */
export async function getStudentMarks(
  studentId: string,
): Promise<StudentSubjectMarks[]> {
  const supabase = createClient();
  const components = await listMarkComponents();

  const { data } = await supabase
    .from("student_subject_marks")
    .select(
      "student_id, subject_id, component_code, marks, max_marks, remark, published_at",
    )
    .eq("student_id", studentId)
    .limit(500);

  const markRows = (data ?? []) as MarkRow[];
  if (markRows.length === 0) return [];

  // Subject names come from a second query rather than an embedded join: the
  // hand-written types carry `Relationships: []` (see `supabase/types.ts`), so
  // postgrest-js cannot resolve `vtu_subjects(...)` at the type level. Same
  // approach as `attachDomains()` in `queries/vtu.ts`.
  const { data: subjectRows } = await supabase
    .from("vtu_subjects")
    .select("id, code, name")
    .in("id", [...new Set(markRows.map((r) => r.subject_id))]);

  const subjectById = new Map(
    ((subjectRows ?? []) as Array<{ id: string; code: string; name: string }>).map(
      (row) => [row.id, row],
    ),
  );

  const bySubject = new Map<
    string,
    { code: string; name: string; entries: MarkEntry[] }
  >();

  for (const row of markRows) {
    const subject = subjectById.get(row.subject_id);
    if (!subject) continue;

    const existing = bySubject.get(row.subject_id) ?? {
      code: subject.code,
      name: subject.name,
      entries: [],
    };
    existing.entries.push(mapEntry(row));
    bySubject.set(row.subject_id, existing);
  }

  const result: StudentSubjectMarks[] = [];

  for (const [subjectId, subject] of bySubject) {
    const visible = releasedOnly(subject.entries);
    if (visible.length === 0) continue;

    const { scored, outOf, recordedCount } = sumRecorded(visible);

    result.push({
      subjectId,
      subjectCode: subject.code,
      subjectName: subject.name,
      cells: pivotToComponents(components, visible),
      scored,
      outOf,
      recordedCount,
    });
  }

  return result.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
}
