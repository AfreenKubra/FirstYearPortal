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

import type { Role } from "@/config/roles";

/** Mirrors `public.user_role`; the values live in `config/roles.ts`. */
export type UserRole = Role;
export type AccountStatus = "pending" | "active" | "rejected" | "suspended";
export type MilestoneLinkSource = "catalogue" | "ai_suggested";
import type { ResidenceType } from "@/config/residence";
import type { EventKind, RegistrationStatus } from "@/config/events";
import type { ResourceKind } from "@/config/resources";
import type { NotificationKind } from "@/config/notifications";
import type { Horizon } from "@/lib/roadmap/generate";
import type { RoadmapSource, RoadmapStatus } from "@/config/roadmap";
import type {
  AssessmentKind,
  QuestionKind,
  AttemptStatus,
} from "@/config/assessments";
import type {
  AchievementCategory,
  AchievementLevel,
  VerificationStatus,
} from "@/config/achievements";

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
      achievements: {
        Row: {
          id: string;
          student_id: string;
          category: AchievementCategory;
          title: string;
          description: string | null;
          level: AchievementLevel;
          organisation: string | null;
          achieved_on: string;
          verification_status: VerificationStatus;
          verified_by: string | null;
          verified_at: string | null;
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          student_id: string;
          category: AchievementCategory;
          title: string;
          description?: string | null;
          level: AchievementLevel;
          organisation?: string | null;
          achieved_on: string;
        };
        Update: Partial<{
          category: AchievementCategory;
          title: string;
          description: string | null;
          level: AchievementLevel;
          organisation: string | null;
          achieved_on: string;
          verification_status: VerificationStatus;
          verified_by: string | null;
          verified_at: string | null;
          remarks: string | null;
        }>;
        Relationships: [];
      };
      achievement_documents: {
        Row: {
          id: string;
          achievement_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          uploaded_at: string;
        };
        Insert: {
          achievement_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: NotificationKind;
          title: string;
          body: string | null;
          link: string | null;
          entity_type: string | null;
          entity_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: Partial<{ read_at: string | null }>;
        Relationships: [];
      };
      vtu_subjects: {
        Row: {
          id: string;
          department_code: string;
          semester: number;
          code: string;
          name: string;
          credits: number | null;
          scheme_year: number;
          official_url: string;
          notes: string | null;
          added_by: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          department_code: string;
          semester: number;
          code: string;
          name: string;
          credits?: number | null;
          scheme_year: number;
          official_url: string;
          notes?: string | null;
          added_by?: string | null;
        };
        Update: Partial<{
          name: string;
          credits: number | null;
          official_url: string;
          notes: string | null;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      vtu_subject_domains: {
        Row: { subject_id: string; domain_id: number };
        Insert: { subject_id: string; domain_id: number };
        Update: never;
        Relationships: [];
      };
      mark_components: {
        Row: {
          code: string;
          label: string;
          max_marks: number;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          code: string;
          label: string;
          max_marks: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<{
          label: string;
          max_marks: number;
          sort_order: number;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      student_subject_marks: {
        Row: {
          student_id: string;
          subject_id: string;
          component_code: string;
          // `numeric`. Arrives as a number from the installed stack, but
          // PostgREST may serialise it as a string; queries/marks.ts
          // normalises both rather than depending on which.
          marks: number | string | null;
          max_marks: number;
          remark: string | null;
          published_at: string | null;
          entered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          student_id: string;
          subject_id: string;
          component_code: string;
          marks?: number | null;
          max_marks: number;
          remark?: string | null;
          published_at?: string | null;
          // Pinned by trigger to the calling faculty member — supplying it
          // here has no effect, which is the point.
          entered_by?: string | null;
        };
        Update: Partial<{
          marks: number | null;
          max_marks: number;
          remark: string | null;
          published_at: string | null;
        }>;
        Relationships: [];
      };
      student_roadmaps: {
        Row: {
          id: string;
          student_id: string;
          generated_by: RoadmapSource;
          provider: string | null;
          model: string | null;
          inputs_summary: string | null;
          inputs_fingerprint: string | null;
          approval_status: RoadmapStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          mentor_remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          student_id: string;
          generated_by?: RoadmapSource;
          provider?: string | null;
          model?: string | null;
          inputs_summary?: string | null;
          inputs_fingerprint?: string | null;
          approval_status?: RoadmapStatus;
        };
        Update: Partial<{
          approval_status: RoadmapStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          mentor_remarks: string | null;
        }>;
        Relationships: [];
      };
      roadmap_milestones: {
        Row: {
          id: string;
          roadmap_id: string;
          horizon: Horizon;
          title: string;
          detail: string | null;
          rationale: string;
          position: number;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          roadmap_id: string;
          horizon: Horizon;
          title: string;
          detail?: string | null;
          rationale: string;
          position?: number;
        };
        Update: Partial<{ completed_at: string | null }>;
        Relationships: [];
      };
      roadmap_milestone_links: {
        Row: {
          id: string;
          milestone_id: string;
          link_source: MilestoneLinkSource;
          resource_id: string | null;
          title: string;
          url: string;
          provider: string | null;
          kind: ResourceKind;
          position: number;
          created_at: string;
        };
        Insert: {
          milestone_id: string;
          link_source: MilestoneLinkSource;
          resource_id?: string | null;
          title: string;
          url: string;
          provider?: string | null;
          kind?: ResourceKind;
          position?: number;
        };
        // Immutable once written (`guard_milestone_link_immutable`, 0022) —
        // there is no supported update, matching `roadmap_milestones` above.
        Update: never;
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          kind: ResourceKind;
          provider: string | null;
          url: string;
          department_code: string | null;
          semester: number | null;
          estimated_hours: number | null;
          is_free: boolean | null;
          is_verified: boolean;
          verified_by: string | null;
          verified_at: string | null;
          added_by: string | null;
          is_active: boolean;
          // 0023. `date`, not `timestamptz` — postgrest returns these as bare
          // `YYYY-MM-DD` strings, and they are typed as strings here so no
          // caller is tempted to hand one to `new Date()`, which reads a bare
          // date as UTC midnight and prints the previous day west of London.
          occurs_on: string | null;
          registration_opens_on: string | null;
          registration_closes_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          description?: string | null;
          kind?: ResourceKind;
          provider?: string | null;
          url: string;
          department_code?: string | null;
          semester?: number | null;
          estimated_hours?: number | null;
          is_free?: boolean | null;
          occurs_on?: string | null;
          registration_opens_on?: string | null;
          registration_closes_on?: string | null;
          added_by?: string | null;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          kind: ResourceKind;
          provider: string | null;
          url: string;
          department_code: string | null;
          semester: number | null;
          estimated_hours: number | null;
          is_free: boolean | null;
          is_verified: boolean;
          verified_by: string | null;
          verified_at: string | null;
          occurs_on: string | null;
          registration_opens_on: string | null;
          registration_closes_on: string | null;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      resource_interests: {
        Row: { resource_id: string; interest_id: number };
        Insert: { resource_id: string; interest_id: number };
        Update: never;
        Relationships: [];
      };
      resource_goals: {
        Row: { resource_id: string; goal_id: number };
        Insert: { resource_id: string; goal_id: number };
        Update: never;
        Relationships: [];
      };
      resource_domains: {
        Row: { resource_id: string; domain_id: number };
        Insert: { resource_id: string; domain_id: number };
        Update: never;
        Relationships: [];
      };
      // 0024. What an event is *about*, as opposed to `events`' own
      // department/semester/section columns, which say who may attend. A
      // workshop open to everyone can still be tagged to one goal, and a
      // workshop open to one section can be about nothing in particular.
      // Composite primary keys, so there is no row to update — retagging is a
      // delete and an insert, matching `resource_goals` above.
      event_goals: {
        Row: { event_id: string; goal_id: number };
        Insert: { event_id: string; goal_id: number };
        Update: never;
        Relationships: [];
      };
      event_domains: {
        Row: { event_id: string; domain_id: number };
        Insert: { event_id: string; domain_id: number };
        Update: never;
        Relationships: [];
      };
      student_resources: {
        Row: {
          student_id: string;
          resource_id: string;
          saved_at: string;
          completed_at: string | null;
        };
        Insert: { student_id: string; resource_id: string };
        Update: Partial<{ completed_at: string | null }>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          kind: EventKind;
          venue: string | null;
          created_by: string | null;
          department_code: string | null;
          semester: number | null;
          section: string | null;
          starts_at: string;
          ends_at: string | null;
          registration_deadline: string | null;
          capacity: number | null;
          allow_waitlist: boolean;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          description?: string | null;
          kind?: EventKind;
          venue?: string | null;
          created_by?: string | null;
          department_code?: string | null;
          semester?: number | null;
          section?: string | null;
          starts_at: string;
          ends_at?: string | null;
          registration_deadline?: string | null;
          capacity?: number | null;
          allow_waitlist?: boolean;
          is_published?: boolean;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          kind: EventKind;
          venue: string | null;
          department_code: string | null;
          semester: number | null;
          section: string | null;
          starts_at: string;
          ends_at: string | null;
          registration_deadline: string | null;
          capacity: number | null;
          allow_waitlist: boolean;
          is_published: boolean;
        }>;
        Relationships: [];
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          student_id: string;
          status: RegistrationStatus;
          registered_at: string;
          cancelled_at: string | null;
          attended: boolean | null;
          marked_by: string | null;
          marked_at: string | null;
          feedback_rating: number | null;
          feedback_comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          student_id: string;
          status?: RegistrationStatus;
        };
        Update: Partial<{
          status: RegistrationStatus;
          cancelled_at: string | null;
          attended: boolean | null;
          marked_by: string | null;
          marked_at: string | null;
          feedback_rating: number | null;
          feedback_comment: string | null;
        }>;
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          kind: AssessmentKind;
          created_by: string | null;
          department_code: string | null;
          semester: number | null;
          section: string | null;
          opens_at: string | null;
          closes_at: string | null;
          duration_minutes: number | null;
          max_attempts: number;
          pass_percentage: number | null;
          randomise_questions: boolean;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          description?: string | null;
          kind?: AssessmentKind;
          created_by?: string | null;
          department_code?: string | null;
          semester?: number | null;
          section?: string | null;
          opens_at?: string | null;
          closes_at?: string | null;
          duration_minutes?: number | null;
          max_attempts?: number;
          pass_percentage?: number | null;
          randomise_questions?: boolean;
          is_published?: boolean;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          kind: AssessmentKind;
          department_code: string | null;
          semester: number | null;
          section: string | null;
          opens_at: string | null;
          closes_at: string | null;
          duration_minutes: number | null;
          max_attempts: number;
          pass_percentage: number | null;
          randomise_questions: boolean;
          is_published: boolean;
        }>;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          assessment_id: string;
          kind: QuestionKind;
          prompt: string;
          help_text: string | null;
          position: number;
          points: number;
          required: boolean;
          created_at: string;
        };
        Insert: {
          assessment_id: string;
          kind: QuestionKind;
          prompt: string;
          help_text?: string | null;
          position?: number;
          points?: number;
          required?: boolean;
        };
        Update: Partial<{
          kind: QuestionKind;
          prompt: string;
          help_text: string | null;
          position: number;
          points: number;
          required: boolean;
        }>;
        Relationships: [];
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          label: string;
          position: number;
          is_correct: boolean | null;
          score_value: number;
          created_at: string;
        };
        Insert: {
          question_id: string;
          label: string;
          position?: number;
          is_correct?: boolean | null;
          score_value?: number;
        };
        Update: Partial<{
          label: string;
          position: number;
          is_correct: boolean | null;
          score_value: number;
        }>;
        Relationships: [];
      };
      assessment_attempts: {
        Row: {
          id: string;
          assessment_id: string;
          student_id: string;
          attempt_number: number;
          status: AttemptStatus;
          started_at: string;
          submitted_at: string | null;
          score: number | null;
          max_score: number | null;
          percentage: number | null;
          passed: boolean | null;
          graded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          student_id: string;
          attempt_number?: number;
          status?: AttemptStatus;
        };
        Update: Partial<{
          status: AttemptStatus;
          submitted_at: string | null;
          score: number | null;
          max_score: number | null;
          percentage: number | null;
          passed: boolean | null;
          graded_at: string | null;
        }>;
        Relationships: [];
      };
      student_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_option_ids: string[];
          text_answer: string | null;
          awarded_points: number | null;
          graded_by: string | null;
          graded_at: string | null;
          grader_remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          attempt_id: string;
          question_id: string;
          selected_option_ids?: string[];
          text_answer?: string | null;
        };
        Update: Partial<{
          selected_option_ids: string[];
          text_answer: string | null;
          awarded_points: number | null;
          graded_by: string | null;
          graded_at: string | null;
          grader_remarks: string | null;
        }>;
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
      user_roles: {
        Row: { user_id: string; role: UserRole; granted_at: string };
        Insert: { user_id: string; role: UserRole };
        Update: never;
        Relationships: [];
      };
      admin_allowlist: {
        Row: { email: string; note: string | null; added_at: string };
        Insert: { email: string; note?: string | null };
        Update: Partial<{ note: string | null }>;
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
      exam_questions: {
        Row: {
          id: string;
          assessment_id: string;
          kind: QuestionKind;
          prompt: string;
          help_text: string | null;
          position: number;
          points: number;
          required: boolean;
        };
        Relationships: [];
      };
      exam_options: {
        Row: {
          id: string;
          question_id: string;
          label: string;
          position: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_hod: { Args: Record<string, never>; Returns: boolean };
      department_roadmap_stats: {
        Args: { p_department: string };
        Returns: Array<{
          cohort_size: number | null;
          avg_completion: number | null;
          avg_milestones: number | null;
          students_with_plan: number | null;
        }>;
      };
      has_role: { Args: { p_role: UserRole }; Returns: boolean };
      current_roles: { Args: Record<string, never>; Returns: UserRole[] };
      current_hod_department: {
        Args: Record<string, never>;
        Returns: string | null;
      };
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
