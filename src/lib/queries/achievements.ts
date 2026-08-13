import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AchievementCategory,
  AchievementLevel,
  VerificationStatus,
} from "@/config/achievements";

export type EvidenceDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  /** Short-lived signed URL; null if the link could not be minted. */
  url: string | null;
};

export type Achievement = {
  id: string;
  studentId: string;
  category: AchievementCategory;
  title: string;
  description: string | null;
  level: AchievementLevel;
  organisation: string | null;
  achievedOn: string;
  status: VerificationStatus;
  verifiedAt: string | null;
  verifiedByName: string | null;
  remarks: string | null;
  createdAt: string;
  documents: EvidenceDocument[];
};

const COLUMNS =
  "id, student_id, category, title, description, level, organisation, achieved_on, verification_status, verified_by, verified_at, remarks, created_at" as const;

type AchievementRow = {
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
};

/**
 * Attaches evidence documents and resolves verifier names.
 *
 * Signed URLs are minted server-side and expire in five minutes. The bucket
 * is private because evidence routinely carries a student's full name and
 * registration number — a permanent public URL would leak that to anyone who
 * ever saw the link.
 */
async function hydrate(rows: AchievementRow[]): Promise<Achievement[]> {
  if (rows.length === 0) return [];
  const supabase = createClient();

  const ids = rows.map((r) => r.id);
  const verifierIds = Array.from(
    new Set(rows.map((r) => r.verified_by).filter(Boolean) as string[]),
  );

  const [docsResult, facultyResult] = await Promise.all([
    supabase
      .from("achievement_documents")
      .select("id, achievement_id, storage_path, file_name, mime_type, size_bytes")
      .in("achievement_id", ids),
    verifierIds.length > 0
      ? supabase.from("faculty").select("id, full_name").in("id", verifierIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const verifierNames = new Map(
    (facultyResult.data ?? []).map((f) => [f.id, f.full_name]),
  );

  const docs = docsResult.data ?? [];
  const signed = new Map<string, string>();

  if (docs.length > 0) {
    const { data } = await supabase.storage
      .from("achievement-evidence")
      .createSignedUrls(
        docs.map((d) => d.storage_path),
        300,
      );
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  const docsByAchievement = new Map<string, EvidenceDocument[]>();
  for (const doc of docs) {
    const list = docsByAchievement.get(doc.achievement_id) ?? [];
    list.push({
      id: doc.id,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes,
      storagePath: doc.storage_path,
      url: signed.get(doc.storage_path) ?? null,
    });
    docsByAchievement.set(doc.achievement_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    category: row.category,
    title: row.title,
    description: row.description,
    level: row.level,
    organisation: row.organisation,
    achievedOn: row.achieved_on,
    status: row.verification_status,
    verifiedAt: row.verified_at,
    verifiedByName: row.verified_by
      ? verifierNames.get(row.verified_by) ?? "A mentor"
      : null,
    remarks: row.remarks,
    createdAt: row.created_at,
    documents: docsByAchievement.get(row.id) ?? [],
  }));
}

/** The signed-in student's own achievements, newest achievement first. */
export async function getOwnAchievements(
  studentId: string,
): Promise<Achievement[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("achievements")
    .select(COLUMNS)
    .eq("student_id", studentId)
    .order("achieved_on", { ascending: false });

  return hydrate((data ?? []) as AchievementRow[]);
}

/**
 * Achievements for one student, for a reviewer.
 *
 * Scoping comes from RLS — an unauthorised faculty member simply sees no
 * rows, exactly as with the student directory.
 */
export async function getAchievementsForStudent(
  studentId: string,
): Promise<Achievement[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("achievements")
    .select(COLUMNS)
    .eq("student_id", studentId)
    .order("achieved_on", { ascending: false });

  return hydrate((data ?? []) as AchievementRow[]);
}

export type PendingVerification = Achievement & {
  studentName: string;
  studentUsn: string;
};

/** Everything awaiting this reviewer's decision, oldest submission first. */
export async function getPendingVerifications(): Promise<PendingVerification[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("achievements")
    .select(COLUMNS)
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  const rows = (data ?? []) as AchievementRow[];
  if (rows.length === 0) return [];

  const hydrated = await hydrate(rows);

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, usn")
    .in("id", Array.from(new Set(rows.map((r) => r.student_id))));

  const byId = new Map((students ?? []).map((s) => [s.id, s]));

  return hydrated.map((a) => ({
    ...a,
    studentName: byId.get(a.studentId)?.full_name ?? "Unknown student",
    studentUsn: byId.get(a.studentId)?.usn ?? "—",
  }));
}

/** Count for the faculty sidebar badge. */
export async function getPendingVerificationCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("achievements")
    .select("id", { count: "exact", head: true })
    .eq("verification_status", "pending");
  return count ?? 0;
}

export type AchievementSummary = {
  total: number;
  verified: number;
  pending: number;
  rejected: number;
};

export function summariseAchievements(
  achievements: Achievement[],
): AchievementSummary {
  return {
    total: achievements.length,
    verified: achievements.filter((a) => a.status === "verified").length,
    pending: achievements.filter((a) => a.status === "pending").length,
    rejected: achievements.filter((a) => a.status === "rejected").length,
  };
}
