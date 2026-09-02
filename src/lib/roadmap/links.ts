/**
 * Attaching concrete links to roadmap milestones (PRD 5.10, MANUAL-STEPS.md
 * 3.4).
 *
 * Pure and dependency-free, like `recommend.ts` it builds on: every function
 * here takes plain data in and returns plain data out, so the caller
 * (`refresh.ts`, `actions/roadmaps.ts`) does all the Supabase I/O and this
 * file is trivial to hold to a fixed input/output contract in a test.
 *
 * Two independent sources feed the same shape, and both run for every
 * roadmap regardless of which generator produced its milestones:
 *
 *   - `attachCatalogueLinks` — the admin-verified `resources` table (PRD
 *     5.9), matched the same way the resources page already ranks the
 *     catalogue for a student, just narrowed to what one milestone's own
 *     rationale actually names.
 *   - `attachAiSuggestedLinks` — a language model's `provider` + `keyword`
 *     pairs (`ai-generate.ts`), resolved into a real URL by
 *     `link-providers.ts`'s fixed whitelist. Nothing here ever trusts a URL
 *     from the model — there isn't one to trust.
 */

import {
  recommendResources,
  type ResourceForMatching,
  type StudentProfileForMatching,
} from "@/lib/resources/recommend";
import { buildProviderLink } from "./link-providers";
import type { AiLinkSuggestion } from "./ai-schema";
import type { ResourceKind } from "@/config/resources";

export type MilestoneLinkContent = {
  linkSource: "catalogue" | "ai_suggested";
  resourceId: string | null;
  title: string;
  url: string;
  provider: string | null;
  kind: ResourceKind;
};

/** A catalogue resource, with everything a link row needs to copy from it. */
export type CatalogueResourceForLinking = ResourceForMatching & {
  title: string;
  url: string;
  provider: string | null;
  kind: ResourceKind;
};

export type NamedTag = { id: number; name: string };

/**
 * The student's own goals/domains/interests, as names as well as ids.
 *
 * Names are what let a milestone's rationale be checked against the
 * profile's own words, rather than assumed to be about "the student" in
 * general — see `attachCatalogueLinks` below.
 */
export type StudentProfileWithNames = {
  departmentCode: string;
  semester: number | null;
  goals: NamedTag[];
  domains: NamedTag[];
  interests: NamedTag[];
};

const CATALOGUE_LINKS_PER_MILESTONE = 2;

/**
 * Narrows the student's profile to only the goal/domain/interest a specific
 * milestone's rationale actually mentions.
 *
 * Without this, every milestone on a roadmap would recommend the same
 * catalogue matches — whatever ranks highest for the student overall — which
 * would misrepresent *why* that particular milestone linked to that
 * particular resource. A milestone whose rationale names nothing specific
 * (rare, but possible for a generic nudge) narrows to nothing and gets no
 * catalogue link, rather than falling back to the student's whole profile.
 */
function narrowProfileForMilestone(
  rationale: string,
  profile: StudentProfileWithNames,
): StudentProfileForMatching {
  const pick = (tags: NamedTag[]) =>
    tags.filter((tag) => rationale.includes(tag.name)).map((tag) => tag.id);

  return {
    departmentCode: profile.departmentCode,
    semester: profile.semester,
    goalIds: pick(profile.goals),
    domainIds: pick(profile.domains),
    interestIds: pick(profile.interests),
  };
}

/**
 * Matches each milestone against the admin-verified catalogue, narrowed to
 * what that milestone's own rationale names.
 *
 * Returns one array per input milestone, in the same order, so the caller
 * can zip the result back up against the milestones it just inserted.
 */
export function attachCatalogueLinks(
  milestones: ReadonlyArray<{ rationale: string }>,
  resources: CatalogueResourceForLinking[],
  profile: StudentProfileWithNames,
  limitPerMilestone = CATALOGUE_LINKS_PER_MILESTONE,
): MilestoneLinkContent[][] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  return milestones.map((milestone) => {
    const narrowed = narrowProfileForMilestone(milestone.rationale, profile);

    if (
      narrowed.goalIds.length === 0 &&
      narrowed.domainIds.length === 0 &&
      narrowed.interestIds.length === 0
    ) {
      return [];
    }

    return recommendResources(resources, narrowed, limitPerMilestone)
      .map((match) => byId.get(match.resourceId))
      .filter((resource): resource is CatalogueResourceForLinking => resource !== undefined)
      .map((resource) => ({
        linkSource: "catalogue" as const,
        resourceId: resource.id,
        title: resource.title,
        url: resource.url,
        provider: resource.provider,
        kind: resource.kind,
      }));
  });
}

const AI_LINKS_PER_MILESTONE = 2;
const AI_LINKS_TOTAL = 6;

/**
 * Resolves a language model's link suggestions into real, attachable links.
 *
 * This is the last of three independent gates a suggestion has to clear
 * (after the model's own tool schema, and `ai-generate.ts`'s milestone-index
 * revalidation): a provider name that does not match the fixed whitelist in
 * `link-providers.ts` is dropped here, silently, rather than guessed at.
 * Also enforces the per-milestone and total caps, so one enthusiastic
 * response cannot bury a milestone's genuine rationale under a wall of
 * links.
 */
export function attachAiSuggestedLinks(
  milestoneCount: number,
  suggestions: AiLinkSuggestion[],
): MilestoneLinkContent[][] {
  const perMilestone: MilestoneLinkContent[][] = Array.from(
    { length: milestoneCount },
    () => [],
  );

  let total = 0;
  for (const suggestion of suggestions) {
    if (total >= AI_LINKS_TOTAL) break;
    if (suggestion.milestoneIndex < 0 || suggestion.milestoneIndex >= milestoneCount) {
      continue;
    }

    const bucket = perMilestone[suggestion.milestoneIndex];
    if (bucket.length >= AI_LINKS_PER_MILESTONE) continue;

    const link = buildProviderLink(suggestion.provider, suggestion.keyword);
    if (!link) continue;

    bucket.push({
      linkSource: "ai_suggested",
      resourceId: null,
      title: suggestion.label,
      url: link.url,
      provider: link.providerLabel,
      kind: suggestion.kind,
    });
    total += 1;
  }

  return perMilestone;
}

/**
 * Merges the two link sources for the same milestone list, catalogue first.
 *
 * Order matters here, not just cosmetically: an admin-verified resource is a
 * stronger claim than an AI-suggested one, so a student scanning a
 * milestone's links top-to-bottom sees the vouched-for option before the
 * unverified one, every time — never left to whichever source happened to
 * run last.
 */
export function combineMilestoneLinks(
  catalogueLinks: MilestoneLinkContent[][],
  aiSuggestedLinks: MilestoneLinkContent[][],
): MilestoneLinkContent[][] {
  const length = Math.max(catalogueLinks.length, aiSuggestedLinks.length);
  return Array.from({ length }, (_, index) => [
    ...(catalogueLinks[index] ?? []),
    ...(aiSuggestedLinks[index] ?? []),
  ]);
}
