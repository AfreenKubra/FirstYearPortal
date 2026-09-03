import { z } from "zod";
import { SKILL_CATEGORY_VALUES } from "@/config/assessments";

/**
 * Self-reported external test score validation.
 *
 * There is nothing here to verify against — no attempt record, no grading
 * trigger — so this schema is the only check this data ever gets. It stays
 * narrow on purpose: a title, a platform, a score exactly as the student
 * typed it, and an optional link, never a computed pass/fail or percentile
 * this portal has no basis for asserting.
 */
export const externalScoreSchema = z.object({
  platform: z
    .string()
    .trim()
    .min(2, "Say which platform this was on.")
    .max(80, "Keep the platform name under 80 characters."),
  testName: z
    .string()
    .trim()
    .min(2, "Name the test or course.")
    .max(200, "Keep the test name under 200 characters."),
  scoreLabel: z
    .string()
    .trim()
    .min(1, "Enter your score or result.")
    .max(60, "Keep the score under 60 characters."),
  certificateUrl: z
    .string()
    .trim()
    .url("Enter a full link, starting http:// or https://")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  category: z
    .enum(SKILL_CATEGORY_VALUES)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type ExternalScoreValues = z.infer<typeof externalScoreSchema>;
