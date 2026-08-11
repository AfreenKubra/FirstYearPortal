import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  type StudentFilters,
} from "@/lib/faculty/filters";
import type { LookupOption } from "./student";
import type { AdmissionQuota } from "@/lib/supabase/types";
import { residenceLabel, type ResidenceType } from "@/config/residence";

export type FacultyRecord = {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  departmentCode: string;
  designation: string;
};

export type DirectoryRow = {
  id: string;
  fullName: string;
  usn: string;
  email: string;
  phone: string;
  departmentCode: string;
  city: string;
  state: string;
  semester: number | null;
  section: string | null;
  quota: string | null;
  residenceType: string | null;
  tenthPercentage: number | null;
  twelfthPercentage: number | null;
  entranceRank: number | null;
  completionPercent: number;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianVisible: boolean;
};

/** The caller's own faculty row, or null if they are not active faculty. */
export async function getOwnFaculty(): Promise<FacultyRecord | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("faculty")
    .select(
      "id, full_name, employee_code, email, phone, department_code, designation",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    employeeCode: data.employee_code,
    email: data.email,
    phone: data.phone,
    departmentCode: data.department_code,
    designation: data.designation,
  };
}

type DirectoryDbRow = {
  id: string;
  full_name: string;
  usn: string;
  email: string;
  phone: string;
  department_code: string;
  city: string;
  state: string;
  semester: number | null;
  section: string | null;
  quota: string | null;
  residence_type: string | null;
  tenth_percentage: number | null;
  twelfth_percentage: number | null;
  entrance_rank: number | null;
  profile_completion_percent: number;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_visible: boolean;
};

function mapRow(row: DirectoryDbRow): DirectoryRow {
  return {
    id: row.id,
    fullName: row.full_name,
    usn: row.usn,
    email: row.email,
    phone: row.phone,
    departmentCode: row.department_code,
    city: row.city,
    state: row.state,
    semester: row.semester,
    section: row.section,
    quota: row.quota,
    residenceType: row.residence_type,
    tenthPercentage: row.tenth_percentage,
    twelfthPercentage: row.twelfth_percentage,
    entranceRank: row.entrance_rank,
    completionPercent: row.profile_completion_percent,
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    guardianVisible: row.guardian_visible,
  };
}

/**
 * Kept as a single string literal rather than a concatenation: postgrest-js
 * parses the select list at the *type* level, and a computed string collapses
 * every result to `GenericStringError`.
 */
const DIRECTORY_COLUMNS =
  "id, full_name, usn, email, phone, department_code, city, state, semester, section, quota, residence_type, tenth_percentage, twelfth_percentage, entrance_rank, profile_completion_percent, guardian_name, guardian_phone, guardian_visible" as const;

/**
 * Resolves the student ids matching a many-to-many filter (interest, goal,
 * domain). Returns null when no such filter is active.
 *
 * Done as a separate lookup rather than a join because PostgREST cannot
 * express "students having interest X" through a view — and an empty result
 * here must narrow the directory to nothing, not be ignored.
 */
async function idsForSelectionFilters(
  filters: StudentFilters,
): Promise<string[] | null> {
  const supabase = createClient();
  const sets: string[][] = [];

  if (filters.interestId !== null) {
    const { data } = await supabase
      .from("student_interests")
      .select("student_id")
      .eq("interest_id", filters.interestId);
    sets.push((data ?? []).map((r) => r.student_id));
  }
  if (filters.goalId !== null) {
    const { data } = await supabase
      .from("student_goals")
      .select("student_id")
      .eq("goal_id", filters.goalId);
    sets.push((data ?? []).map((r) => r.student_id));
  }
  if (filters.domainId !== null) {
    const { data } = await supabase
      .from("student_domains")
      .select("student_id")
      .eq("domain_id", filters.domainId);
    sets.push((data ?? []).map((r) => r.student_id));
  }

  if (sets.length === 0) return null;

  // Combining filters means intersection: a student must match all of them.
  return sets.reduce((acc, set) => {
    const other = new Set(set);
    return acc.filter((id) => other.has(id));
  });
}

export type DirectoryPage = {
  rows: DirectoryRow[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * Lists students the caller may see.
 *
 * Note there is no faculty-id parameter: scoping comes from RLS on
 * `student_directory`, which resolves through `can_faculty_view_student()`.
 * A bug in the filters below can therefore return the wrong subset, but it
 * cannot return a student the caller is not entitled to.
 */
export async function listStudents(
  filters: StudentFilters,
): Promise<DirectoryPage> {
  const supabase = createClient();

  const selectionIds = await idsForSelectionFilters(filters);
  if (selectionIds !== null && selectionIds.length === 0) {
    return { rows: [], total: 0, page: filters.page, pageCount: 0 };
  }

  let query = supabase
    .from("student_directory")
    .select(DIRECTORY_COLUMNS, { count: "exact" });

  if (selectionIds !== null) query = query.in("id", selectionIds);
  if (filters.department) query = query.eq("department_code", filters.department);
  if (filters.semester !== null) query = query.eq("semester", filters.semester);
  if (filters.section) query = query.eq("section", filters.section);
  // Casts are safe: `parseFilters` only ever emits values from the enum
  // allow-lists, and anything else was already dropped to null.
  if (filters.quota) {
    query = query.eq("quota", filters.quota as AdmissionQuota);
  }
  if (filters.residenceType) {
    query = query.eq("residence_type", filters.residenceType as ResidenceType);
  }
  if (filters.completion === "complete") {
    query = query.eq("profile_completion_percent", 100);
  }
  if (filters.completion === "incomplete") {
    query = query.lt("profile_completion_percent", 100);
  }
  if (filters.minTenth !== null) {
    query = query.gte("tenth_percentage", filters.minTenth);
  }
  if (filters.minTwelfth !== null) {
    query = query.gte("twelfth_percentage", filters.minTwelfth);
  }
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,usn.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
  }

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("full_name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    return { rows: [], total: 0, page: filters.page, pageCount: 0 };
  }

  const total = count ?? 0;
  return {
    rows: (data ?? []).map(mapRow),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Every matching row, ignoring pagination — used only for CSV export. */
export async function listAllStudentsForExport(
  filters: StudentFilters,
): Promise<DirectoryRow[]> {
  const page = await listStudents({ ...filters, page: 1 });
  if (page.total <= PAGE_SIZE) return page.rows;

  const rows = [...page.rows];
  for (let p = 2; p <= page.pageCount && p <= 200; p++) {
    const next = await listStudents({ ...filters, page: p });
    rows.push(...next.rows);
  }
  return rows;
}

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

/**
 * Dashboard aggregates over the caller's assigned students.
 *
 * Computed in application code over the full assigned set rather than with
 * SQL GROUP BY, because RLS already narrows the rows and a first-year cohort
 * per mentor is small. If assignment sizes grow into the thousands this
 * should move to a database-side aggregate.
 */
export async function getFacultyStats(): Promise<FacultyStats> {
  const all = await listAllStudentsForExport(EMPTY_FILTERS);

  return {
    total: all.length,
    complete: all.filter((r) => r.completionPercent === 100).length,
    incomplete: all.filter((r) => r.completionPercent < 100).length,
    byDepartment: tally(all, (r) => r.departmentCode),
    bySemester: tally(all, (r) => (r.semester ? `Semester ${r.semester}` : null)),
    byQuota: tally(all, (r) => (r.quota ? QUOTA_LABELS[r.quota] ?? r.quota : null)),
    byResidence: tally(all, (r) =>
      r.residenceType ? residenceLabel(r.residenceType) : null,
    ),
    needsFollowUp: all
      .filter((r) => r.completionPercent < 100)
      .sort((a, b) => a.completionPercent - b.completionPercent)
      .slice(0, 8),
  };
}

export type StudentDetail = {
  row: DirectoryRow;
  interests: string[];
  goals: string[];
  domains: string[];
  languages: string[];
  departmentName: string;
};

/**
 * One student's full authorised profile.
 *
 * Returns null when the caller may not see them — RLS makes the row simply
 * not exist for an unauthorised faculty member, so "not found" and "not
 * permitted" are indistinguishable here by design.
 */
export async function getStudentDetail(
  studentId: string,
): Promise<StudentDetail | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("student_directory")
    .select(DIRECTORY_COLUMNS)
    .eq("id", studentId)
    .maybeSingle();

  if (!data) return null;
  const row = mapRow(data);

  const [interests, goals, domains, languages, department] = await Promise.all([
    supabase.from("student_interests").select("interest_id").eq("student_id", studentId),
    supabase.from("student_goals").select("goal_id").eq("student_id", studentId),
    supabase.from("student_domains").select("domain_id").eq("student_id", studentId),
    supabase.from("student_languages").select("language_id").eq("student_id", studentId),
    supabase
      .from("departments")
      .select("name")
      .eq("code", row.departmentCode)
      .maybeSingle(),
  ]);

  const [interestOpts, goalOpts, domainOpts, languageOpts] = await Promise.all([
    supabase.from("interests").select("id, name"),
    supabase.from("career_goals").select("id, name"),
    supabase.from("technical_domains").select("id, name"),
    supabase.from("languages").select("id, name"),
  ]);

  const resolve = (
    options: LookupOption[] | null,
    ids: number[],
  ): string[] => {
    const map = new Map((options ?? []).map((o) => [o.id, o.name]));
    return ids.map((id) => map.get(id)).filter(Boolean) as string[];
  };

  return {
    row,
    interests: resolve(
      interestOpts.data as LookupOption[] | null,
      (interests.data ?? []).map((r) => r.interest_id),
    ),
    goals: resolve(
      goalOpts.data as LookupOption[] | null,
      (goals.data ?? []).map((r) => r.goal_id),
    ),
    domains: resolve(
      domainOpts.data as LookupOption[] | null,
      (domains.data ?? []).map((r) => r.domain_id),
    ),
    languages: resolve(
      languageOpts.data as LookupOption[] | null,
      (languages.data ?? []).map((r) => r.language_id),
    ),
    departmentName: department.data?.name ?? row.departmentCode,
  };
}
