/**
 * Hand-written mirror of `supabase/migrations/0001_init_mvp.sql`.
 *
 * This is a deliberate stopgap (ARCHITECTURE.md section 11). Once the schema
 * stabilises, regenerate with:
 *
 *     supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * Note the `Relationships: []` on every table - postgrest-js's generics
 * require the key to be present even when empty, and omitting it produces a
 * confusing type error far from the cause.
 */

export type UserRole = "student" | "faculty" | "admin";
export type AccountStatus = "pending" | "active" | "rejected" | "suspended";
import type { ResidenceType } from "@/config/residence";

export type { ResidenceType };
export type AdmissionQuota =
  | "cet"
  | "comedk"
  | "management"
  | "jee"
  | "diploma_lateral"
  | "other";

type LookupRow = { id: number; name: string; is_active: boolean };

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          status: AccountStatus;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          status?: AccountStatus;
          last_login_at?: string | null;
        };
        Update: {
          email?: string;
          role?: UserRole;
          status?: AccountStatus;
          last_login_at?: string | null;
        };
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          dob: string;
          usn: string;
          phone: string;
          email: string;
          username: string;
          state: string;
          city: string;
          department_code: string;
          guardian_name: string;
          guardian_phone: string;
          profile_photo_url: string | null;
          residence_type: ResidenceType | null;
          profile_completion_percent: number;
          consent_given_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          dob: string;
          usn: string;
          phone: string;
          email: string;
          username: string;
          state: string;
          city: string;
          department_code: string;
          guardian_name: string;
          guardian_phone: string;
          profile_photo_url?: string | null;
          residence_type?: ResidenceType | null;
          profile_completion_percent?: number;
          consent_given_at?: string | null;
        };
        Update: Partial<{
          full_name: string;
          dob: string;
          phone: string;
          state: string;
          city: string;
          department_code: string;
          guardian_name: string;
          guardian_phone: string;
          profile_photo_url: string | null;
          residence_type: ResidenceType | null;
          profile_completion_percent: number;
          consent_given_at: string | null;
        }>;
        Relationships: [];
      };
      student_academic_profiles: {
        Row: {
          student_id: string;
          tenth_percentage: number | null;
          twelfth_percentage: number | null;
          quota: AdmissionQuota | null;
          entrance_rank: number | null;
          semester: number | null;
          section: string | null;
          admission_year: number | null;
          updated_at: string;
        };
        Insert: {
          student_id: string;
          tenth_percentage?: number | null;
          twelfth_percentage?: number | null;
          quota?: AdmissionQuota | null;
          entrance_rank?: number | null;
          semester?: number | null;
          section?: string | null;
          admission_year?: number | null;
        };
        Update: Partial<{
          tenth_percentage: number | null;
          twelfth_percentage: number | null;
          quota: AdmissionQuota | null;
          entrance_rank: number | null;
          semester: number | null;
          section: string | null;
          admission_year: number | null;
        }>;
        Relationships: [];
      };
      student_languages: {
        Row: { student_id: string; language_id: number };
        Insert: { student_id: string; language_id: number };
        Update: { language_id?: number };
        Relationships: [];
      };
      student_interests: {
        Row: { student_id: string; interest_id: number };
        Insert: { student_id: string; interest_id: number };
        Update: { interest_id?: number };
        Relationships: [];
      };
      student_goals: {
        Row: { student_id: string; goal_id: number };
        Insert: { student_id: string; goal_id: number };
        Update: { goal_id?: number };
        Relationships: [];
      };
      student_domains: {
        Row: { student_id: string; domain_id: number };
        Insert: { student_id: string; domain_id: number };
        Update: { domain_id?: number };
        Relationships: [];
      };
      consent_records: {
        Row: {
          id: string;
          student_id: string;
          consent_type: string;
          consent_text: string;
          granted: boolean;
          granted_at: string;
        };
        Insert: {
          student_id: string;
          consent_type: string;
          consent_text: string;
          granted: boolean;
        };
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          actor_user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [];
      };
      admins: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          employee_code: string;
          email: string;
          designation: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name: string;
          employee_code: string;
          email: string;
          designation?: string;
        };
        Update: Partial<{ full_name: string; designation: string }>;
        Relationships: [];
      };
      faculty: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          employee_code: string;
          email: string;
          phone: string;
          department_code: string;
          designation: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name: string;
          employee_code: string;
          email: string;
          phone: string;
          department_code: string;
          designation: string;
        };
        Update: Partial<{
          full_name: string;
          phone: string;
          department_code: string;
          designation: string;
        }>;
        Relationships: [];
      };
      faculty_student_assignments: {
        Row: {
          id: string;
          faculty_id: string;
          department_code: string | null;
          semester: number | null;
          section: string | null;
          student_id: string | null;
          is_mentor: boolean;
          created_at: string;
        };
        Insert: {
          faculty_id: string;
          department_code?: string | null;
          semester?: number | null;
          section?: string | null;
          student_id?: string | null;
          is_mentor?: boolean;
        };
        Update: Partial<{
          department_code: string | null;
          semester: number | null;
          section: string | null;
          student_id: string | null;
          is_mentor: boolean;
        }>;
        Relationships: [];
      };
      mentoring_notes: {
        Row: {
          id: string;
          student_id: string;
          faculty_id: string;
          note: string;
          created_at: string;
        };
        Insert: { student_id: string; faculty_id: string; note: string };
        Update: never;
        Relationships: [];
      };
      departments: {
        Row: { code: string; name: string; is_active: boolean; created_at: string };
        Insert: { code: string; name: string; is_active?: boolean };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      languages: {
        Row: LookupRow;
        Insert: { name: string; is_active?: boolean };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      interests: {
        Row: LookupRow & { category: string | null };
        Insert: { name: string; category?: string | null; is_active?: boolean };
        Update: Partial<{ name: string; category: string | null; is_active: boolean }>;
        Relationships: [];
      };
      career_goals: {
        Row: LookupRow;
        Insert: { name: string; is_active?: boolean };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      technical_domains: {
        Row: LookupRow;
        Insert: { name: string; is_active?: boolean };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
    };
    Views: {
      /**
       * Read-only student view with guardian contact masked to NULL unless
       * the caller is the assigned mentor or an admin (migration 0003).
       * Runs with `security_invoker`, so the row policies on `students`
       * still apply through it.
       */
      student_directory: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          usn: string;
          email: string;
          phone: string;
          dob: string;
          state: string;
          city: string;
          department_code: string;
          residence_type: ResidenceType | null;
          profile_completion_percent: number;
          created_at: string;
          tenth_percentage: number | null;
          twelfth_percentage: number | null;
          quota: AdmissionQuota | null;
          entrance_rank: number | null;
          semester: number | null;
          section: string | null;
          admission_year: number | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          guardian_visible: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      current_faculty_id: { Args: Record<string, never>; Returns: string | null };
      can_faculty_view_student: {
        Args: { p_student_id: string; p_mentor_only?: boolean };
        Returns: boolean;
      };
      is_assigned_mentor: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      residence_type: ResidenceType;
      admission_quota: AdmissionQuota;
    };
    CompositeTypes: Record<string, never>;
  };
};
