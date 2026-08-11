import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  summariseDepartments,
  summariseInstitution,
  type AnalyticsStudent,
  type DepartmentSummary,
  type InstitutionStats,
} from "@/lib/admin/analytics";

export type AdminRecord = {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  designation: string;
};

/** The caller's own admin row, or null if they are not an active admin. */
export async function getOwnAdmin(): Promise<AdminRecord | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admins")
    .select("id, full_name, employee_code, email, designation")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    employeeCode: data.employee_code,
    email: data.email,
    designation: data.designation,
  };
}

const STUDENT_COLUMNS =
  "id, department_code, state, semester, section, quota, residence_type, tenth_percentage, twelfth_percentage, profile_completion_percent" as const;

type StudentAnalyticsRow = AnalyticsStudent & { state: string | null };

/**
 * Every student in the institution.
 *
 * Reads through `student_directory`, so admin visibility comes from the same
 * RLS path faculty use rather than a separate privileged query — an admin
 * sees everything because `is_admin()` says so, not because this function
 * bypassed the policy.
 *
 * Paged in blocks because PostgREST caps a single response at 1000 rows.
 */
async function fetchAllStudents(): Promise<StudentAnalyticsRow[]> {
  const supabase = createClient();
  const pageSize = 1000;
  const rows: StudentAnalyticsRow[] = [];

  for (let page = 0; page < 100; page++) {
    const { data, error } = await supabase
      .from("student_directory")
      .select(STUDENT_COLUMNS)
      .order("id", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (error || !data || data.length === 0) break;

    rows.push(
      ...data.map((row) => ({
        id: row.id,
        departmentCode: row.department_code,
        state: row.state,
        semester: row.semester,
        section: row.section,
        quota: row.quota,
        residenceType: row.residence_type,
        tenthPercentage: row.tenth_percentage,
        twelfthPercentage: row.twelfth_percentage,
        completionPercent: row.profile_completion_percent,
      })),
    );

    if (data.length < pageSize) break;
  }

  return rows;
}

export type AdminOverview = {
  institution: InstitutionStats;
  departments: DepartmentSummary[];
  facultyCount: number;
  pendingAccounts: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = createClient();

  const [students, departmentRows, facultyCount, pendingCount] = await Promise.all([
    fetchAllStudents(),
    supabase.from("departments").select("code, name").order("name"),
    supabase.from("faculty").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const departments = departmentRows.data ?? [];

  return {
    institution: summariseInstitution(students, (row) => row.state),
    departments: summariseDepartments(students, departments),
    facultyCount: facultyCount.count ?? 0,
    pendingAccounts: pendingCount.count ?? 0,
  };
}

// --- Account approval queue -------------------------------------------------

export type PendingAccount = {
  userId: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  fullName: string | null;
  /** Employee code for staff, USN for students. */
  identifier: string | null;
  departmentCode: string | null;
  designation: string | null;
};

/** Cheap count for the sidebar badge — avoids loading the whole queue. */
export async function getPendingCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

/**
 * Accounts awaiting a decision, plus recently decided ones for context.
 *
 * The faculty profile is joined in application code rather than through a
 * PostgREST embed: `users` has no foreign key to `faculty` (the relationship
 * runs the other way), so an embed would not resolve.
 */
export async function getAccountQueue(): Promise<{
  pending: PendingAccount[];
  recent: PendingAccount[];
}> {
  const supabase = createClient();

  // Students are included since migration 0008 — every role now needs
  // approval, so filtering them out here would hide most of the queue.
  const { data: accounts } = await supabase
    .from("users")
    .select("id, email, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  // All three profile tables are consulted: an administrator's details live
  // in `admins`, a faculty member's in `faculty`, a student's in `students`.
  // Looking in only one would leave most requests showing as a bare email.
  const [facultyRows, adminRows, studentRows] = await Promise.all([
    supabase
      .from("faculty")
      .select("user_id, full_name, employee_code, department_code, designation"),
    supabase.from("admins").select("user_id, full_name, employee_code, designation"),
    supabase.from("students").select("user_id, full_name, usn, department_code"),
  ]);

  const facultyByUser = new Map(
    (facultyRows.data ?? []).map((f) => [f.user_id, f]),
  );
  const adminsByUser = new Map(
    (adminRows.data ?? []).map((a) => [a.user_id, a]),
  );
  const studentsByUser = new Map(
    (studentRows.data ?? []).map((s) => [s.user_id, s]),
  );

  const mapped: PendingAccount[] = (accounts ?? []).map((account) => {
    const faculty = facultyByUser.get(account.id);
    const admin = adminsByUser.get(account.id);
    const student = studentsByUser.get(account.id);

    return {
      userId: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      createdAt: account.created_at,
      fullName:
        student?.full_name ?? faculty?.full_name ?? admin?.full_name ?? null,
      identifier:
        student?.usn ?? faculty?.employee_code ?? admin?.employee_code ?? null,
      departmentCode:
        student?.department_code ?? faculty?.department_code ?? null,
      designation: faculty?.designation ?? admin?.designation ?? null,
    };
  });

  return {
    // Oldest first: a student who registered on day one should be approved
    // before someone who signed up an hour ago.
    pending: mapped
      .filter((a) => a.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    recent: mapped.filter((a) => a.status !== "pending").slice(0, 25),
  };
}

// --- Faculty assignments ----------------------------------------------------

export type AssignmentRow = {
  id: string;
  facultyId: string;
  facultyName: string;
  facultyCode: string;
  departmentCode: string | null;
  semester: number | null;
  section: string | null;
  studentId: string | null;
  studentName: string | null;
  isMentor: boolean;
  createdAt: string;
};

export async function getAssignments(): Promise<AssignmentRow[]> {
  const supabase = createClient();

  const { data: assignments } = await supabase
    .from("faculty_student_assignments")
    .select(
      "id, faculty_id, department_code, semester, section, student_id, is_mentor, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (!assignments || assignments.length === 0) return [];

  const [facultyRows, studentRows] = await Promise.all([
    supabase.from("faculty").select("id, full_name, employee_code"),
    supabase.from("students").select("id, full_name, usn"),
  ]);

  const faculty = new Map((facultyRows.data ?? []).map((f) => [f.id, f]));
  const students = new Map((studentRows.data ?? []).map((s) => [s.id, s]));

  return assignments.map((row) => {
    const f = faculty.get(row.faculty_id);
    const s = row.student_id ? students.get(row.student_id) : null;

    return {
      id: row.id,
      facultyId: row.faculty_id,
      facultyName: f?.full_name ?? "Unknown faculty",
      facultyCode: f?.employee_code ?? "—",
      departmentCode: row.department_code,
      semester: row.semester,
      section: row.section,
      studentId: row.student_id,
      studentName: s ? `${s.full_name} (${s.usn})` : null,
      isMentor: row.is_mentor,
      createdAt: row.created_at,
    };
  });
}

export async function getFacultyOptions() {
  const supabase = createClient();
  const { data } = await supabase
    .from("faculty")
    .select("id, full_name, employee_code, department_code")
    .order("full_name");
  return data ?? [];
}

// --- Departments ------------------------------------------------------------

export async function getDepartmentsWithCounts() {
  const supabase = createClient();

  const [departments, students] = await Promise.all([
    supabase.from("departments").select("code, name, is_active").order("name"),
    fetchAllStudents(),
  ]);

  return (departments.data ?? []).map((dept) => ({
    ...dept,
    studentCount: students.filter((s) => s.departmentCode === dept.code).length,
  }));
}

// --- Audit log --------------------------------------------------------------

export type AuditEntry = {
  id: number;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const supabase = createClient();

  const { data: entries } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_user_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!entries || entries.length === 0) return [];

  const { data: actors } = await supabase.from("users").select("id, email");
  const byId = new Map((actors ?? []).map((u) => [u.id, u.email]));

  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    actorEmail: entry.actor_user_id ? byId.get(entry.actor_user_id) ?? null : null,
    metadata: entry.metadata ?? {},
    createdAt: entry.created_at,
  }));
}

export { fetchAllStudents };
