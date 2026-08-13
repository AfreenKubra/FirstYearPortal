import "server-only";

import { createClient } from "@/lib/supabase/server";
import { EMPTY_FILTERS, type StudentFilters } from "@/lib/faculty/filters";
import { listAllMatchingStudents, type DirectoryRow } from "./directory";
import { residenceLabel } from "@/config/residence";
import type { Role } from "@/config/roles";

/**
 * Teaching-staff reads.
 *
 * Faculty mentors and heads of department share one profile table and one
 * directory implementation (`queries/directory.ts`); what differs is how far
 * RLS lets each of them see. Everything role-specific lives here.
 */

export type StaffRecord = {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  departmentCode: string;
  designation: string;
  /** From the `users` shadow table, not the profile row. */
  role: Role;
};

/** Kept as the old name so existing faculty screens read unchanged. */
export type FacultyRecord = StaffRecord;

/**
 * The caller's own staff row, or null if they have no active staff profile.
 *
 * Reads the role from `users` rather than inferring it from the designation
 * text: "Head of Department" is a job title anyone can select at
 * registration, whereas `users.role` is what every policy actually keys off.
 */
export async function getOwnStaff(): Promise<StaffRecord | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data }, { data: account }] = await Promise.all([
    supabase
      .from("faculty")
      .select(
        "id, full_name, employee_code, email, phone, department_code, designation",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
  ]);

  if (!data || !account) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    employeeCode: data.employee_code,
    email: data.email,
    phone: data.phone,
    departmentCode: data.department_code,
    designation: data.designation,
    role: account.role,
  };
}

/** Back-compatible alias used by the faculty screens. */
export const getOwnFaculty = getOwnStaff;

export type FacultyStats = {
  total: number;
  complete: number;
  incomplete: number;
  byDepartment: Array<{ label: string; count: number }>;
  bySemester: Array<{ label: string; count: number }>;
  byQuota: Array<{ label: string; count: number }>;
  byResidence: Array<{ label: string; count: number }>;
  needsFollowUp: DirectoryRow[];
};

const QUOTA_LABELS: Record<string, string> = {
  cet: "KCET",
  comedk: "COMEDK",
  jee: "JEE / Central",
  management: "Management",
  diploma_lateral: "Diploma lateral",
  other: "Other",
};

function tally(
  rows: DirectoryRow[],
  pick: (row: DirectoryRow) => string | null,
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row) ?? "Not set";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** Distribution counts over an already-fetched set of students. */
export function summariseRows(rows: DirectoryRow[]): FacultyStats {
  return {
    total: rows.length,
    complete: rows.filter((r) => r.completionPercent === 100).length,
    incomplete: rows.filter((r) => r.completionPercent < 100).length,
    byDepartment: tally(rows, (r) => r.departmentCode),
    bySemester: tally(rows, (r) => (r.semester ? `Semester ${r.semester}` : null)),
    byQuota: tally(rows, (r) => (r.quota ? QUOTA_LABELS[r.quota] ?? r.quota : null)),
    byResidence: tally(rows, (r) =>
      r.residenceType ? residenceLabel(r.residenceType) : null,
    ),
    needsFollowUp: rows
      .filter((r) => r.completionPercent < 100)
      .sort((a, b) => a.completionPercent - b.completionPercent)
      .slice(0, 8),
  };
}

/**
 * Dashboard aggregates over every student the caller can see.
 *
 * Computed in application code rather than with SQL GROUP BY, because RLS has
 * already narrowed the rows and a first-year cohort per mentor or department
 * is small. If these sets grow into the thousands this should move to a
 * database-side aggregate.
 */
export async function getFacultyStats(
  filters: StudentFilters = EMPTY_FILTERS,
): Promise<FacultyStats> {
  return summariseRows(await listAllMatchingStudents(filters));
}

export type {
  DirectoryRow,
  DirectoryPage,
  StudentDetail,
} from "./directory";
export {
  listStudents,
  listAllMatchingStudents,
  getStudentDetail,
} from "./directory";
