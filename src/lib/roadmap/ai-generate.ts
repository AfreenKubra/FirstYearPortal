import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  describeInputs,
  type GeneratedMilestone,
  type RoadmapInput,
} from "./generate";
import {
  AI_HORIZONS,
  SUBMIT_ROADMAP_TOOL,
  aiRoadmapSchema,
  type AiLinkSuggestion,
  type AiMilestone,
} from "./ai-schema";
import { listProvidersForPrompt } from "./link-providers";
import type { GeneratedRoadmapWithLinks, RoadmapGenerator } from "./provider";

/**
 * The Claude-backed roadmap generator (PRD 5.10, MANUAL-STEPS.md 3.1/3.4).
 *
 * This file is the only place a language model's own words are allowed to
 * become part of a student's plan, and it exists to make that as narrow and
 * checkable as possible:
 *
 *   - The model is forced into a single tool call (`SUBMIT_ROADMAP_TOOL`)
 *     whose schema has no `url` field anywhere — it cannot hand back a link,
 *     only a `provider` name and a search `keyword` (`link-providers.ts`
 *     turns those into a real URL later, deterministically).
 *   - Every milestone the model writes is re-run through the exact same
 *     "invents nothing" checks `generate.test.ts` holds the rule-based
 *     generator to: no URL, no named course/certification/company, no
 *     salary or placement statistic. A milestone that fails is dropped, not
 *     the whole roadmap.
 *   - A surviving milestone's rationale must still literally name one of the
 *     student's own inputs — grounding is checked, not assumed.
 *   - If dropping milestones leaves any of the three horizons empty, the
 *     whole response is rejected. A partially-AI, partially-empty roadmap is
 *     worse than falling back to the rule-based one, which is exactly what
 *     `generateWithFallback` does whenever this module throws.
 */

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_TOKENS = 4096;

// The identical checks `generate.test.ts` runs against the rule-based
// generator's "invents nothing" guarantee. Duplicated rather than imported
// from the test file — production code must not depend on a test file — but
// kept literally in sync with it; a change to one should prompt a look at
// the other.
const URL_PATTERN = /https?:\/\//;
const WWW_PATTERN = /www\./;
const INVENTED_NAMES = [
  "NPTEL",
  "Coursera",
  "Udemy",
  "AWS Certified",
  "Google",
  "Microsoft",
  "TCS",
  "Infosys",
];
const MONEY_PATTERN = /LPA|lakh|package|₹|\$\d/i;
const STAT_PATTERN = /\d+%\s*(of|placement|students get)/i;

function isPolluted(milestone: AiMilestone): boolean {
  const text = `${milestone.title} ${milestone.detail ?? ""} ${milestone.rationale}`;
  if (URL_PATTERN.test(text) || WWW_PATTERN.test(text)) return true;
  if (INVENTED_NAMES.some((name) => text.includes(name))) return true;
  if (MONEY_PATTERN.test(text) || STAT_PATTERN.test(text)) return true;
  return false;
}

/** The literal facts a rationale is allowed to point at. */
function groundingFacts(input: RoadmapInput): string[] {
  return [input.departmentName, ...input.goals, ...input.domains, ...input.interests].filter(
    (s) => s.trim().length > 0,
  );
}

function isGrounded(milestone: AiMilestone, facts: string[]): boolean {
  return facts.some((fact) => milestone.rationale.includes(fact));
}

/**
 * The minimal shape this module needs from an Anthropic client.
 *
 * Narrow on purpose: a test hands in a plain object implementing just
 * `messages.create`, matching this codebase's existing convention of
 * dependency injection over `vi.mock`. The real SDK's client satisfies this
 * structurally, so no adapter is needed at the call site in `provider.ts`.
 */
export type AnthropicLikeClient = {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: "user"; content: string }>;
      tools: Array<Record<string, unknown>>;
      tool_choice: Record<string, unknown>;
    }): Promise<{
      content: Array<{ type: string; name?: string; input?: unknown }>;
    }>;
  };
};

function buildSystemPrompt(): string {
  const providerLines = listProvidersForPrompt()
    .map(
      (p) =>
        `- ${p.key}${p.needsKeyword ? " (needs a short search keyword)" : " (fixed page — keyword ignored)"}: ${p.label}`,
    )
    .join("\n");

  return [
    "You are drafting a personal development roadmap for a first-year Indian",
    "engineering student, to be submitted via the `submit_roadmap` tool.",
    "Be creative in how you frame the approach — the ordering, the way you",
    "phrase a challenge, an unusual but sound combination of actions — but",
    "never creative with facts.",
    "",
    "Hard rules for every milestone's `title`, `detail`, and `rationale`:",
    "1. Never write a URL, a domain name, or the word \"www\" — you have no",
    "   `url` field available to you anywhere in this tool, by design.",
    "2. Never name a specific course, certification, company, or learning",
    "   platform (for example NPTEL, Coursera, Udemy, AWS, Google, Microsoft,",
    "   TCS, Infosys). Those belong only in `linkSuggestions`, never in",
    "   milestone text.",
    "3. Never quote a salary, package, LPA figure, ranking, or placement",
    "   percentage. You do not have real data for this and must not imply",
    "   that you do.",
    "4. Every `rationale` must literally mention the student's department",
    "   name, one of their stated goals, one of their technical domains, or",
    "   one of their interests, copied exactly as given below — the student",
    "   must be able to see which of their own answers produced this",
    "   milestone.",
    "",
    "For `linkSuggestions`, `provider` must be one of exactly these values",
    "(never a URL, and never a provider not on this list — GATE and other",
    "government exams are deliberately not on it and must not be guessed at):",
    providerLines,
    "",
    "At most 2 link suggestions per milestone. `milestoneIndex` is the",
    "0-based position of the milestone inside the `milestones` array you",
    "submit in this same call.",
  ].join("\n");
}

function buildUserPrompt(input: RoadmapInput): string {
  return [
    "Student profile (nothing beyond this was shared with you):",
    describeInputs(input),
    "",
    "Draft milestones across all three horizons — thirty_days,",
    "three_to_six_months, and one_to_four_years — with at least one",
    "milestone in each. Call `submit_roadmap` with your answer now.",
  ].join("\n");
}

/**
 * Wraps an Anthropic client as a `RoadmapGenerator`.
 *
 * `client` is optional and exists for tests; production code (`provider.ts`)
 * calls this with no argument, which constructs a real `Anthropic` client
 * from `ANTHROPIC_API_KEY`. The model id can be overridden with
 * `ANTHROPIC_MODEL` without a code change or redeploy.
 */
export function createAnthropicGenerator(
  client?: AnthropicLikeClient,
): RoadmapGenerator {
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const anthropic: AnthropicLikeClient =
    client ??
    (new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    }) as unknown as AnthropicLikeClient);

  return {
    source: "ai",
    provider: "anthropic",
    model,

    async generate(input: RoadmapInput): Promise<GeneratedRoadmapWithLinks> {
      const response = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: buildUserPrompt(input) }],
        tools: [SUBMIT_ROADMAP_TOOL],
        tool_choice: { type: "tool", name: SUBMIT_ROADMAP_TOOL.name },
      });

      const toolUse = response.content.find(
        (block) => block.type === "tool_use" && block.name === SUBMIT_ROADMAP_TOOL.name,
      );
      if (!toolUse) {
        throw new Error("The model did not call submit_roadmap.");
      }

      const parsed = aiRoadmapSchema.parse(toolUse.input);
      const facts = groundingFacts(input);

      const survivors: Array<{ milestone: AiMilestone; originalIndex: number }> = [];
      parsed.milestones.forEach((milestone, originalIndex) => {
        if (isPolluted(milestone)) return;
        if (!isGrounded(milestone, facts)) return;
        survivors.push({ milestone, originalIndex });
      });

      const presentHorizons = new Set(survivors.map((s) => s.milestone.horizon));
      for (const horizon of AI_HORIZONS) {
        if (!presentHorizons.has(horizon)) {
          throw new Error(
            `The AI roadmap had no valid milestone left for "${horizon}" after safety validation.`,
          );
        }
      }

      const indexMap = new Map<number, number>();
      survivors.forEach((survivor, newIndex) => indexMap.set(survivor.originalIndex, newIndex));

      const milestones: GeneratedMilestone[] = survivors.map((survivor) => ({
        horizon: survivor.milestone.horizon,
        title: survivor.milestone.title,
        detail: survivor.milestone.detail ?? null,
        rationale: survivor.milestone.rationale,
      }));

      // Re-point every suggestion at the sanitized array's index, and drop
      // any whose milestone did not survive validation above — a link is
      // never attached to a milestone the student will not actually see.
      const linkSuggestions: AiLinkSuggestion[] = parsed.linkSuggestions.flatMap(
        (suggestion) => {
          const newIndex = indexMap.get(suggestion.milestoneIndex);
          if (newIndex === undefined) return [];
          return [{ ...suggestion, milestoneIndex: newIndex }];
        },
      );

      return {
        milestones,
        inputsSummary: describeInputs(input),
        linkSuggestions,
      };
    },
  };
}
