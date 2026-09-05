import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, type StudentFilters } from "@/lib/faculty/filters";
import { getProfilePhotoUrl, type LookupOption } from "./student";
import type { AdmissionQuota } from "@/lib/supabase/types";
import type { ResidenceType } from "@/config/residence";

/**
 * The student directory — one implementation, three audiences.
 *
 * Nothing in this file takes a faculty id, a department, or a role. Scoping
 * comes entirely from RLS on `student_directory`, which resolves through
 * `can_faculty_view_student()`: a mentor sees their assignments, a head of
 * department sees their department, an administrator sees the institution.
 * That is what lets the faculty, HOD, and admin screens share these functions
 * rather than each growing its own near-copy — and it means a bug in the
 * filters below can return the wrong subset, but cannot return a student the
 * caller is not entitled to.
 */

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
  /** Storage path of the uploaded photo, or null. Signed at render time. */
  photoPath: string | null;
  /** Signed URL for `photoPath`. Filled in for a rendered page only. */
  photoUrl: string | null;
};

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
  profile_photo_url: string | null;
};

export function mapRow(row: DirectoryDbRow): DirectoryRow {
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
    photoPath: row.profile_photo_url,
    photoUrl: null,
  };
}

/**
 * Kept as a single string literal rather than a concatenation: postgrest-js
 * parses the select list at the *type* level, and a computed string collapses
 * every result to `GenericStringError`.
 */
const DIRECTORY_COLUMNS =
  "id, full_name, usn, email, phone, department_code, city, state, semester, section, quota, residence_type, tenth_percentage, twelfth_percentage, entrance_rank, profile_completion_percent, guardian_name, guardian_phone, guardian_visible, profile_photo_url" as const;

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

/**
 * Applies every filter to a `student_directory` query.
 *
 * Generic over the builder rather than naming postgrest-js's filter-builder
 * type: that type's signature has already changed once between releases (see
 * README, known limitations), and spelling it out here would pin this file to
 * an internal detail. The constraint below is the part that actually matters —
 * whatever comes in must support the filter methods used, and whatever goes
 * out is the same type, so the caller keeps its row typing.
 */
type FilterableQuery<T> = {
  in(column: string, values: readonly string[]): T;
  eq(column: string, value: string | number): T;
  lt(column: string, value: number): T;
  gte(column: string, value: number): T;
  or(filter: string): T;
};

function applyFilters<T extends FilterableQuery<T>>(
  query: T,
  filters: StudentFilters,
  selectionIds: string[] | null,
): T {
  let q = query;

  if (selectionIds !== null) q = q.in("id", selectionIds);
  if (filters.department) q = q.eq("department_code", filters.department);
  if (filters.semester !== null) q = q.eq("semester", filters.semester);
  if (filters.section) q = q.eq("section", filters.section);
  // Casts are safe: `parseFilters` only ever emits values from the enum
  // allow-lists, and anything else was already dropped to null.
  if (filters.quota) q = q.eq("quota", filters.quota as AdmissionQuota);
  if (filters.residenceType) {
    q = q.eq("residence_type", filters.residenceType as ResidenceType);
  }
  if (filters.completion === "complete") {
    q = q.eq("profile_completion_percent", 100);
  }
  if (filters.completion === "incomplete") {
    q = q.lt("profile_completion_percent", 100);
  }
  if (filters.minTenth !== null) q = q.gte("tenth_percentage", filters.minTenth);
  if (filters.minTwelfth !== null) {
    q = q.gte("twelfth_percentage", filters.minTwelfth);
  }
  if (filters.q) {
    // `,` `(` `)` and `%` are PostgREST's own `or=` grammar. Stripping them
    // keeps a search term from being read as filter syntax rather than text.
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      q = q.or(
        `full_name.ilike.%${term}%,usn.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
  }

  return q;
}

export type DirectoryPage = {
  rows: DirectoryRow[];
  total: number;
  page: number;
  pageCount: number;
};

/** One page of students the caller may see. */
export async function listStudents(
  filters: StudentFilters,
): Promise<DirectoryPage> {
  const supabase = createClient();

  const selectionIds = await idsForSelectionFilters(filters);
  if (selectionIds !== null && selectionIds.length === 0) {
    return { rows: [], total: 0, page: filters.page, pageCount: 0 };
  }

  const query = applyFilters(
    supabase.from("student_directory").select(DIRECTORY_COLUMNS, { count: "exact" }),
    filters,
    selectionIds,
  );

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("full_name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    return { rows: [], total: 0, page: filters.page, pageCount: 0 };
  }

  const rows = (data ?? []).map(mapRow);

  // Signed here rather than in `listAllMatchingStudents`: this is one page,
  // so the signatures are bounded by PAGE_SIZE. That function can return
  // thousands of rows for an export, and an export carries no photos.
  await Promise.all(
    rows
      .filter((row) => row.photoPath !== null)
      .map(async (row) => {
        row.photoUrl = await getProfilePhotoUrl(row.photoPath);
      }),
  );

  const total = count ?? 0;
  return {
    rows,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** PostgREST caps a single response at 1000 rows, so larger sets are blocked. */
const BLOCK_SIZE = 1000;

/**
 * Every row matching the filters, ignoring pagination.
 *
 * This is what the charts and the CSV export both read, so the picture on
 * screen and the file that leaves the building are computed from one query
 * rather than two that could disagree. `cap` bounds the work: a filter that
 * matches the whole institution should produce a large report, not an
 * unbounded one.
 */
export async function listAllMatchingStudents(
  filters: StudentFilters,
  cap = 5000,
): Promise<DirectoryRow[]> {
  const supabase = createClient();

  const selectionIds = await idsForSelectionFilters(filters);
  if (selectionIds !== null && selectionIds.length === 0) return [];

  const rows: DirectoryRow[] = [];

  for (let start = 0; start < cap; start += BLOCK_SIZE) {
    const query = applyFilters(
      supabase.from("student_directory").select(DIRECTORY_COLUMNS),
      filters,
      selectionIds,
    );

    const { data, error } = await query
      .order("full_name", { ascending: true })
      .range(start, start + BLOCK_SIZE - 1);

    if (error || !data || data.length === 0) break;

    rows.push(...data.map(mapRow));
    if (data.length < BLOCK_SIZE) break;
  }

  return rows;
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
 * not exist for an unauthorised reader, so "not found" and "not permitted"
 * are indistinguishable here by design.
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

  const resolve = (options: LookupOption[] | null, ids: number[]): string[] => {
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
