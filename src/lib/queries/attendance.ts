import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AttendanceFigures } from "@/lib/marks/sheet-import";
import type { SubjectAttendanceInput } from "@/lib/attendance/summary";

/**
 * Class attendance reads (migration 0045). Scoping is RLS's, as everywhere:
 * a student gets their own rows, staff get the students they can see.
 */

/** The signed-in student's attendance in every subject that has any. */
export async function getOwnAttendance(studentId: string): Promise<SubjectAttendanceInput[]> {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("student_subject_attendance")
    .select("subject_id, classes_held, classes_attended")
    .eq("student_id", studentId);

  if (!rows || rows.length === 0) return [];

  // Two-step join, the pattern the rest of the query layer uses.
  const { data: subjects } = await supabase
    .from("vtu_subjects")
    .select("id, code, name")
    .in(
      "id",
      rows.map((r) => r.subject_id),
    );

  const byId = new Map((subjects ?? []).map((s) => [s.id, s]));

  return rows.map((r) => ({
    subjectId: r.subject_id,
    code: byId.get(r.subject_id)?.code ?? "—",
    name: byId.get(r.subject_id)?.name ?? "Subject",
    held: r.classes_held,
    attended: r.classes_attended,
  }));
}

/** One subject's attendance for a set of students, keyed by student id. */
export async function getSubjectAttendance(
  subjectId: string,
  studentIds: readonly string[],
): Promise<Map<string, AttendanceFigures>> {
  if (studentIds.length === 0) return new Map();

  const supabase = createClient();
  const { data } = await supabase
    .from("student_subject_attendance")
    .select("student_id, classes_held, classes_attended")
    .eq("subject_id", subjectId)
    .in("student_id", [...studentIds]);

  return new Map(
    (data ?? []).map((r) => [
      r.student_id,
      { held: r.classes_held, attended: r.classes_attended },
    ]),
  );
}
