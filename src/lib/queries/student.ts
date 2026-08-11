import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProfileSnapshot } from "@/lib/profile-completion";

export type LookupOption = { id: number; name: string };

export type StudentRecord = {
  id: string;
  fullName: string;
  usn: string;
  email: string;
  phone: string;
  dob: string;
  state: string;
  city: string;
  departmentCode: string;
  departmentName: string;
  guardianName: string;
  guardianPhone: string;
  residenceType: string | null;
  completionPercent: number;
};

/**
 * Resolves the *caller's own* student row from their session.
 *
 * Every server action starts here rather than accepting a student id from
 * the client (ARCHITECTURE section 3, layer 2). Returning null means "no
 * session or no student record" — callers must treat that as a hard stop,
 * never as a reason to fall back to a wider query.
 */
export async function getOwnStudent(): Promise<StudentRecord | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("students")
    .select(
      "id, full_name, usn, email, phone, dob, state, city, department_code, guardian_name, guardian_phone, residence_type, profile_completion_percent, departments(name)",
    )
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  const department = data.departments as unknown as { name: string } | null;

  return {
    id: data.id,
    fullName: data.full_name,
    usn: data.usn,
    email: data.email,
    phone: data.phone,
    dob: data.dob,
    state: data.state,
    city: data.city,
    departmentCode: data.department_code,
    departmentName: department?.name ?? data.department_code,
    guardianName: data.guardian_name,
    guardianPhone: data.guardian_phone,
    residenceType: data.residence_type,
    completionPercent: data.profile_completion_percent,
  };
}

/** Builds the snapshot that `computeCompletionPercent` consumes. */
export async function getProfileSnapshot(
  student: StudentRecord,
): Promise<ProfileSnapshot> {
  const supabase = createClient();

  const [academic, interests, goals, domains] = await Promise.all([
    supabase
      .from("student_academic_profiles")
      .select("*")
      .eq("student_id", student.id)
      .maybeSingle(),
    supabase
      .from("student_interests")
      .select("interest_id")
      .eq("student_id", student.id),
    supabase.from("student_goals").select("goal_id").eq("student_id", student.id),
    supabase
      .from("student_domains")
      .select("domain_id")
      .eq("student_id", student.id),
  ]);

  return {
    identity: {
      fullName: student.fullName,
      usn: student.usn,
      departmentCode: student.departmentCode,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      residenceType: student.residenceType,
    },
    academic: {
      tenthPercentage: academic.data?.tenth_percentage ?? null,
      twelfthPercentage: academic.data?.twelfth_percentage ?? null,
      quota: academic.data?.quota ?? null,
      semester: academic.data?.semester ?? null,
      section: academic.data?.section ?? null,
      admissionYear: academic.data?.admission_year ?? null,
    },
    interestIds: (interests.data ?? []).map((row) => row.interest_id),
    goalIds: (goals.data ?? []).map((row) => row.goal_id),
    domainIds: (domains.data ?? []).map((row) => row.domain_id),
  };
}

/** Reference options for the profile and registration forms. */
export async function getLookups() {
  const supabase = createClient();

  const [departments, languages, interests, goals, domains] = await Promise.all([
    supabase.from("departments").select("code, name").eq("is_active", true).order("name"),
    supabase.from("languages").select("id, name").eq("is_active", true).order("name"),
    supabase.from("interests").select("id, name").eq("is_active", true).order("name"),
    supabase.from("career_goals").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("technical_domains")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    departments: departments.data ?? [],
    languages: (languages.data ?? []) as LookupOption[],
    interests: (interests.data ?? []) as LookupOption[],
    goals: (goals.data ?? []) as LookupOption[],
    domains: (domains.data ?? []) as LookupOption[],
  };
}
