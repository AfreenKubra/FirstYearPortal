/**
 * Achievement categories, levels, and verification states (PRD 5.4).
 *
 * Defined once and imported by the student form, the faculty verification
 * queue, the student detail view, and the CSV export — the same reasoning as
 * `config/residence.ts`. Enums in the database, labels here.
 */

export const ACHIEVEMENT_CATEGORIES = [
  { value: "academic", label: "Academic" },
  { value: "technical", label: "Technical" },
  { value: "sports", label: "Sports" },
  { value: "cultural", label: "Cultural" },
  { value: "certification", label: "Certification" },
  { value: "social_service", label: "Social service" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "other", label: "Other" },
] as const;

export type AchievementCategory =
  (typeof ACHIEVEMENT_CATEGORIES)[number]["value"];

/** Ordered least to most significant — the order a reader expects. */
export const ACHIEVEMENT_LEVELS = [
  { value: "college", label: "College" },
  { value: "district", label: "District" },
  { value: "state", label: "State" },
  { value: "national", label: "National" },
  { value: "international", label: "International" },
] as const;

export type AchievementLevel = (typeof ACHIEVEMENT_LEVELS)[number]["value"];

export type VerificationStatus = "pending" | "verified" | "rejected";

export const CATEGORY_VALUES = ACHIEVEMENT_CATEGORIES.map((c) => c.value) as [
  AchievementCategory,
  ...AchievementCategory[],
];

export const LEVEL_VALUES = ACHIEVEMENT_LEVELS.map((l) => l.value) as [
  AchievementLevel,
  ...AchievementLevel[],
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  ACHIEVEMENT_CATEGORIES.map((c) => [c.value, c.label]),
);
const LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  ACHIEVEMENT_LEVELS.map((l) => [l.value, l.label]),
);

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return CATEGORY_LABELS[value] ?? value;
}

export function levelLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LEVEL_LABELS[value] ?? value;
}

/** What a student is told their submission currently means. */
export const STATUS_COPY: Record<
  VerificationStatus,
  { label: string; student: string }
> = {
  pending: {
    label: "Awaiting verification",
    student: "Your mentor has not reviewed this yet.",
  },
  verified: {
    label: "Verified",
    student: "Your mentor has confirmed this achievement.",
  },
  rejected: {
    label: "Not verified",
    student: "Your mentor could not verify this. See their remarks below.",
  },
};

// --- Evidence uploads -------------------------------------------------------

/** Mirrors the bucket's `allowed_mime_types` in migration 0009. */
export const EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** Mirrors the bucket's `file_size_limit` in migration 0009. */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_ACCEPT = EVIDENCE_MIME_TYPES.join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
