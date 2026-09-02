import { z } from "zod";
import { RESOURCE_KIND_VALUES } from "@/config/resources";

/**
 * The AI generator's structured output (PRD 5.10, MANUAL-STEPS.md 3.4).
 *
 * The one property that matters most about this file is what it does *not*
 * contain: nowhere in this schema is there a `url` field. The model can name
 * a `provider` (from the whitelist in `link-providers.ts`, passed into its
 * prompt) and a search `keyword` — never a link. `ai-generate.ts` is the only
 * code that turns those two strings into an actual href, deterministically,
 * from a fixed table of real domains. A schema field for a raw URL would
 * reopen exactly the hallucinated-link risk this whole design exists to
 * close, so it is left out rather than added and then ignored.
 *
 * This is also the JSON Schema handed to Anthropic's forced tool-use
 * (`tool_choice`), not just a validator — the model is structurally
 * constrained to producing shapes this schema allows before any of the
 * application-level sanitisation in `ai-generate.ts` even runs.
 */

export const AI_HORIZONS = [
  "thirty_days",
  "three_to_six_months",
  "one_to_four_years",
] as const;

export const aiMilestoneSchema = z.object({
  horizon: z.enum(AI_HORIZONS),
  title: z.string().trim().min(3).max(200),
  detail: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  rationale: z.string().trim().min(3).max(500),
});

export const aiLinkSuggestionSchema = z.object({
  milestoneIndex: z.number().int().min(0),
  provider: z.string().trim().min(1).max(120),
  keyword: z.string().trim().max(200).default(""),
  kind: z.enum(RESOURCE_KIND_VALUES).default("other"),
  label: z.string().trim().min(3).max(200),
});

export const aiRoadmapSchema = z.object({
  milestones: z.array(aiMilestoneSchema).min(1).max(24),
  linkSuggestions: z.array(aiLinkSuggestionSchema).max(48).default([]),
});

export type AiMilestone = z.infer<typeof aiMilestoneSchema>;
export type AiLinkSuggestion = z.infer<typeof aiLinkSuggestionSchema>;
export type AiRoadmap = z.infer<typeof aiRoadmapSchema>;

/**
 * The JSON Schema for the forced tool-use call.
 *
 * Kept in lock-step with the Zod schema above by hand — Anthropic's API
 * takes a plain JSON Schema object, not a Zod schema, and this project has
 * no runtime bridge between the two. The Zod schema is still what actually
 * validates the response; this is what keeps the model from wandering
 * outside those bounds in the first place.
 */
export const SUBMIT_ROADMAP_TOOL = {
  name: "submit_roadmap",
  description:
    "Submit the complete development roadmap: a list of milestones grouped " +
    "by time horizon, and, separately, any concrete resources worth linking " +
    "a milestone to.",
  input_schema: {
    type: "object" as const,
    properties: {
      milestones: {
        type: "array",
        minItems: 1,
        maxItems: 24,
        items: {
          type: "object",
          properties: {
            horizon: { type: "string", enum: AI_HORIZONS },
            title: { type: "string", minLength: 3, maxLength: 200 },
            detail: { type: "string", maxLength: 1000 },
            rationale: { type: "string", minLength: 3, maxLength: 500 },
          },
          required: ["horizon", "title", "rationale"],
        },
      },
      linkSuggestions: {
        type: "array",
        maxItems: 48,
        items: {
          type: "object",
          properties: {
            milestoneIndex: {
              type: "integer",
              minimum: 0,
              description:
                "0-based index into the milestones array this link belongs to.",
            },
            provider: {
              type: "string",
              maxLength: 120,
              description:
                "One of the provider names given to you in the prompt. Never a URL.",
            },
            keyword: {
              type: "string",
              maxLength: 200,
              description: "A short search term for that provider's search page.",
            },
            kind: { type: "string", enum: RESOURCE_KIND_VALUES },
            label: {
              type: "string",
              minLength: 3,
              maxLength: 200,
              description: "A short, student-facing name for this link.",
            },
          },
          required: ["milestoneIndex", "provider", "label"],
        },
      },
    },
    required: ["milestones"],
  },
};
