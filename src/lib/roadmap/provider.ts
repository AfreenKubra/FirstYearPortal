import "server-only";

import {
  generateRoadmap,
  type GeneratedRoadmap,
  type RoadmapInput,
} from "./generate";
import { createAnthropicGenerator } from "./ai-generate";
import type { AiLinkSuggestion } from "./ai-schema";

/**
 * Where a roadmap comes from (PRD 5.10, ARCHITECTURE 6.3).
 *
 * The seam exists so that adding a language model later is one new file and
 * one branch in `resolveGenerator`, rather than a change threaded through the
 * action, the query, and the UI. Everything downstream reads `source`,
 * `provider`, and `model` off whatever comes back and records them with the
 * roadmap, so a mentor can always tell what produced the advice they are
 * being asked to approve.
 *
 * **The AI path** (MANUAL-STEPS.md 3.1) is Claude, via `ai-generate.ts`. It
 * is used only when `ANTHROPIC_API_KEY` is configured, and even then only
 * behind the fallback in `generateWithFallback` below — PRD 5.10 is explicit
 * that the roadmap feature must never simply fail, so an unconfigured key, a
 * timeout, or a model response that fails validation all land back on the
 * rule-based generator rather than an error page.
 */
export type GeneratedRoadmapWithLinks = GeneratedRoadmap & {
  /**
   * Concrete resources the AI generator proposed, each still pointing a
   * `provider` name and `keyword` rather than a URL (`link-providers.ts`
   * resolves the real link later, in `links.ts`). Absent for a rule-based
   * roadmap, which suggests no links of its own — catalogue links are
   * attached separately, from the admin-verified `resources` table,
   * regardless of which generator produced the milestones.
   */
  linkSuggestions?: AiLinkSuggestion[];
};

export type RoadmapGenerator = {
  readonly source: "rule_based" | "ai";
  readonly provider: string | null;
  readonly model: string | null;
  generate(input: RoadmapInput): Promise<GeneratedRoadmapWithLinks>;
};

export const ruleBasedGenerator: RoadmapGenerator = {
  source: "rule_based",
  provider: null,
  model: null,
  async generate(input) {
    return generateRoadmap(input);
  },
};

// Built once and reused, not per-request: constructing an `Anthropic` client
// is cheap but there is no reason to repeat it on every roadmap view.
let cachedAiGenerator: RoadmapGenerator | null = null;

/**
 * Picks the generator to use for this request.
 *
 * Returns the rule-based one whenever no key is configured — which is the
 * only state this portal has ever run in until now, and still the correct
 * answer for an environment (a fresh clone, CI, a contributor's machine)
 * that has not set one up. When a key is present, the AI generator is tried
 * first, with `generateWithFallback` below as the safety net PRD 5.10
 * requires.
 */
export function resolveGenerator(): RoadmapGenerator {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return ruleBasedGenerator;

  cachedAiGenerator ??= createAnthropicGenerator();
  return cachedAiGenerator;
}

/**
 * Generates, falling back if anything goes wrong.
 *
 * Wrapping the call rather than trusting each generator to handle its own
 * failure means a future provider cannot accidentally take the feature down
 * by throwing on a timeout — the requirement is that a student always gets a
 * roadmap, and this is the line that keeps it true.
 *
 * `generatorOverride` exists for tests: it lets `ai-generate.test.ts` prove
 * this exact function falls back correctly, using a generator built from a
 * fake Anthropic client, without reaching for `vi.mock` or a real network
 * call. Every production call site omits it and gets `resolveGenerator()`'s
 * normal choice.
 */
export async function generateWithFallback(
  input: RoadmapInput,
  generatorOverride?: RoadmapGenerator,
): Promise<{ roadmap: GeneratedRoadmapWithLinks; generator: RoadmapGenerator }> {
  const generator = generatorOverride ?? resolveGenerator();

  if (generator.source === "rule_based") {
    return { roadmap: await generator.generate(input), generator };
  }

  try {
    return { roadmap: await generator.generate(input), generator };
  } catch {
    return {
      roadmap: await ruleBasedGenerator.generate(input),
      generator: ruleBasedGenerator,
    };
  }
}
