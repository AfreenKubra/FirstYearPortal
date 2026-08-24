import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * VTU scheme subjects (PRD 5.9's honesty rule, applied to the syllabus).
 *
 * The portal does not scrape vtu.ac.in — an explicit non-goal — and the
 * roadmap generator must not invent subject names. So subjects are rows an
 * administrator entered from the official scheme, each carrying the URL it
 * came from. A department with no rows produces a roadmap that says nothing
 * about the syllabus, which is the correct output for "nobody has told the
 * portal what the scheme is".
 */

export type VtuSubject = {
  id: string;
  departmentCode: string;
  semester: number;
  code: string;
  name: string;
  credits: number | null;
  schemeYear: number;
  officialUrl: string;
  notes: string | null;
  isActive: boolean;
  domainIds: number[];
};

const COLUMNS =
  "id, department_code, semester, code, name, credits, scheme_year, official_url, notes, is_active" as const;

type Row = {
  id: string;
  department_code: string;
  semester: number;
  code: string;
  name: string;
  credits: number | null;
  scheme_year: number;
  official_url: string;
  notes: string | null;
  is_active: boolean;
};

async function attachDomains(rows: Row[]): Promise<VtuSubject[]> {
  if (rows.length === 0) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("vtu_subject_domains")
    .select("subject_id, domain_id")
    .in(
      "subject_id",
      rows.map((r) => r.id),
    );

  const bySubject = new Map<string, number[]>();
  for (const link of data ?? []) {
    bySubject.set(link.subject_id, [
      ...(bySubject.get(link.subject_id) ?? []),
      link.domain_id,
    ]);
  }

  return rows.map((row) => ({
    id: row.id,
    departmentCode: row.department_code,
    semester: row.semester,
    code: row.code,
    name: row.name,
    credits: row.credits,
    schemeYear: row.scheme_year,
    officialUrl: row.official_url,
    notes: row.notes,
    isActive: row.is_active,
    domainIds: bySubject.get(row.id) ?? [],
  }));
}

/** Everything recorded, for the admin screen. */
export async function listVtuSubjects(): Promise<VtuSubject[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("vtu_subjects")
    .select(COLUMNS)
    .order("department_code")
    .order("semester")
    .order("code")
    .limit(1000);

  return attachDomains(data ?? []);
}

/**
 * The subjects that apply to one student.
 *
 * Newest scheme year wins when several are on file: cohorts overlap while VTU
 * revises, and a first-year student is on the most recent scheme. Returns an
 * empty list rather than falling back to another department's subjects — a
 * roadmap citing the wrong branch's syllabus would be worse than one citing
 * none.
 */
export async function getSubjectsFor(
  departmentCode: string,
  semester: number | null,
): Promise<VtuSubject[]> {
  if (semester === null) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("vtu_subjects")
    .select(COLUMNS)
    .eq("department_code", departmentCode)
    .eq("semester", semester)
    .eq("is_active", true)
    .order("scheme_year", { ascending: false })
    .order("code");

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const latest = rows[0].scheme_year;
  return attachDomains(rows.filter((r) => r.scheme_year === latest));
}

/** Department-level cohort figures a student may see about themselves. */
export type DepartmentStats = {
  cohortSize: number | null;
  avgCompletion: number | null;
  avgMilestones: number | null;
};

/**
 * Aggregates only, and nothing at all for a small cohort.
 *
 * The database function returns NULLs below five students carrying a plan,
 * because an "average" over three people is close enough to an individual's
 * own figure to identify them. This mirrors that rather than trying to
 * reconstruct it.
 */
export async function getDepartmentStats(
  departmentCode: string,
): Promise<DepartmentStats> {
  const supabase = createClient();
  const { data } = await supabase.rpc("department_roadmap_stats", {
    p_department: departmentCode,
  });

  const row = Array.isArray(data) ? data[0] : null;

  return {
    cohortSize: row?.cohort_size ?? null,
    avgCompletion: row?.avg_completion === null || row?.avg_completion === undefined
      ? null
      : Number(row.avg_completion),
    avgMilestones: row?.avg_milestones === null || row?.avg_milestones === undefined
      ? null
      : Number(row.avg_milestones),
  };
}
