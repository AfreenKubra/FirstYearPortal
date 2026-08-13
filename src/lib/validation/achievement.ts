import { z } from "zod";
import {
  CATEGORY_VALUES,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_TYPES,
  LEVEL_VALUES,
} from "@/config/achievements";

/**
 * Achievement validation (PRD 5.4). Shared client and server, same as the
 * other schemas — the client run is convenience, the server run is the one
 * that decides.
 */
export const achievementSchema = z.object({
  category: z.enum(CATEGORY_VALUES, {
    errorMap: () => ({ message: "Choose a category." }),
  }),
  title: z
    .string()
    .trim()
    .min(3, "Give this achievement a title of at least 3 characters.")
    .max(160, "Keep the title under 160 characters."),
  description: z
    .string()
    .trim()
    .max(1000, "Keep the description under 1000 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
  level: z.enum(LEVEL_VALUES, {
    errorMap: () => ({ message: "Choose the level at which you achieved this." }),
  }),
  organisation: z
    .string()
    .trim()
    .max(160, "Keep the organiser name under 160 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
  achievedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date you achieved this.")
    .refine((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      // Compared date-only: a certificate dated today is valid, and timezone
      // drift must not make it look like tomorrow.
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return date <= today;
    }, "The date cannot be in the future."),
});

export type AchievementValues = z.infer<typeof achievementSchema>;

export const verificationSchema = z.object({
  achievementId: z.string().uuid("Unknown achievement."),
  decision: z.enum(["verified", "rejected"], {
    errorMap: () => ({ message: "Choose verify or reject." }),
  }),
  remarks: z
    .string()
    .trim()
    .max(500, "Keep remarks under 500 characters.")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type VerificationValues = z.infer<typeof verificationSchema>;

/**
 * Validates an uploaded evidence file.
 *
 * Checked here as well as by the storage bucket's own limits: the bucket
 * rejects a bad file with a generic storage error, whereas this produces a
 * message a student can act on. The bucket remains the real enforcement —
 * this is the explanation.
 */
export function validateEvidenceFile(file: File): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > EVIDENCE_MAX_BYTES) {
    return `That file is larger than 5 MB. Compress it or upload a smaller scan.`;
  }
  if (!(EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Upload a JPEG, PNG, WebP, or PDF.";
  }
  return null;
}

/**
 * Makes a filename safe to use as a storage object path segment.
 *
 * Storage paths are also what the RLS policies parse, so a name containing
 * `/` could otherwise change which folder the object appears to live in.
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120);
  return cleaned.length > 0 ? cleaned : "evidence";
}
