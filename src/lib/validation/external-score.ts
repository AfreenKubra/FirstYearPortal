import { z } from "zod";
import { EXTERNAL_VERIFICATION_VALUES, SKILL_CATEGORY_VALUES } from "@/config/assessments";

/**
 * Self-reported external test score validation.
 *
 * There is nothing here to verify against — no attempt record, no grading
 * trigger — so this schema is the only check this data ever gets. It stays
 * narrow on purpose: a title, a platform, a score exactly as the student
 * typed it, and an optional link, never a computed pass/fail or percentile
 * this portal has no basis for asserting.
 */
/** An empty number field is "not given", not zero. */
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce
    .number({ invalid_type_error: "Enter a number." })
    .min(0, "A score cannot be negative.")
    .max(100000, "That number is too large.")
    .nullable(),
);

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

  /**
   * The numeric pair, given together or not at all.
   *
   * Optional because plenty of real results are not a score out of anything
   * — "Elite", "Pass", "Band 7". Those keep only `scoreLabel`, and the
   * portal shows the words rather than inventing a percentage for them.
   */
  scoreValue: optionalNumber,
  maxScore: optionalNumber,
  takenOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date you took it.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
})
  .refine(
    (v) => (v.scoreValue === null) === (v.maxScore === null),
    {
      message: "Give both your score and the maximum, or neither.",
      path: ["maxScore"],
    },
  )
  .refine(
    (v) => v.scoreValue === null || v.maxScore === null || v.scoreValue <= v.maxScore,
    { message: "Your score cannot be above the maximum.", path: ["scoreValue"] },
  )
  .refine(
    // A result dated in the future is a typo or a claim about something that
    // has not happened. The database refuses it too; this is so the student
    // is told which field, rather than seeing a save fail.
    (v) => v.takenOn === null || v.takenOn <= new Date().toISOString().slice(0, 10),
    { message: "That date is in the future.", path: ["takenOn"] },
  );

/** A staff member's verdict on someone else's self-reported result. */
export const externalVerdictSchema = z.object({
  scoreId: z.string().uuid("Unknown result."),
  verification: z.enum(EXTERNAL_VERIFICATION_VALUES),
  reviewerNote: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type ExternalScoreValues = z.infer<typeof externalScoreSchema>;
