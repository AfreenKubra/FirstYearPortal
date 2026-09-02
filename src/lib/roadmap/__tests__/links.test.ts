import { describe, expect, it } from "vitest";
import {
  attachAiSuggestedLinks,
  attachCatalogueLinks,
  type CatalogueResourceForLinking,
  type StudentProfileWithNames,
} from "../links";
import type { AiLinkSuggestion } from "../ai-schema";

const resource = (
  over: Partial<CatalogueResourceForLinking> & { id: string },
): CatalogueResourceForLinking => ({
  departmentCode: null,
  semester: null,
  interestIds: [],
  goalIds: [],
  domainIds: [],
  isVerified: false,
  title: "Untitled resource",
  url: "https://example.com/resource",
  provider: null,
  kind: "other",
  ...over,
});

const profile: StudentProfileWithNames = {
  departmentCode: "CS",
  semester: 1,
  goals: [{ id: 1, name: "IT / Software employment" }],
  domains: [{ id: 10, name: "Artificial Intelligence & ML" }],
  interests: [{ id: 100, name: "Programming" }],
};

describe("attachCatalogueLinks", () => {
  it("attaches nothing to a milestone whose rationale names nothing in the profile", () => {
    const resources = [resource({ id: "r1", goalIds: [1] })];
    const result = attachCatalogueLinks(
      [{ rationale: "A generic nudge that names nothing specific." }],
      resources,
      profile,
    );
    expect(result).toEqual([[]]);
  });

  it("attaches the resource matching the goal a milestone's rationale names", () => {
    const resources = [
      resource({ id: "goal-match", goalIds: [1], title: "Goal resource", url: "https://goal.example.com" }),
      resource({ id: "unrelated", domainIds: [999] }),
    ];
    const result = attachCatalogueLinks(
      [{ rationale: "Because you want IT / Software employment, do this." }],
      resources,
      profile,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([
      {
        linkSource: "catalogue",
        resourceId: "goal-match",
        title: "Goal resource",
        url: "https://goal.example.com",
        provider: null,
        kind: "other",
      },
    ]);
  });

  it("gives each milestone its own independent matches", () => {
    const resources = [
      resource({ id: "goal-match", goalIds: [1] }),
      resource({ id: "domain-match", domainIds: [10] }),
    ];
    const result = attachCatalogueLinks(
      [
        { rationale: "Because you want IT / Software employment." },
        { rationale: "Because you chose Artificial Intelligence & ML." },
      ],
      resources,
      profile,
    );
    expect(result[0].map((l) => l.resourceId)).toEqual(["goal-match"]);
    expect(result[1].map((l) => l.resourceId)).toEqual(["domain-match"]);
  });

  it("prefers a verified resource in a tie", () => {
    const resources = [
      resource({ id: "unverified", goalIds: [1], isVerified: false, title: "Unverified" }),
      resource({ id: "verified", goalIds: [1], isVerified: true, title: "Verified" }),
    ];
    const result = attachCatalogueLinks(
      [{ rationale: "Because you want IT / Software employment." }],
      resources,
      profile,
      2,
    );
    expect(result[0].map((l) => l.resourceId)).toEqual(["verified", "unverified"]);
  });

  it("respects the per-milestone limit", () => {
    const resources = [
      resource({ id: "a", goalIds: [1] }),
      resource({ id: "b", goalIds: [1] }),
      resource({ id: "c", goalIds: [1] }),
    ];
    const result = attachCatalogueLinks(
      [{ rationale: "Because you want IT / Software employment." }],
      resources,
      profile,
      1,
    );
    expect(result[0]).toHaveLength(1);
  });
});

describe("attachAiSuggestedLinks", () => {
  const suggestion = (over: Partial<AiLinkSuggestion>): AiLinkSuggestion => ({
    milestoneIndex: 0,
    provider: "coursera",
    keyword: "machine learning",
    kind: "course",
    label: "Explore machine learning courses",
    ...over,
  });

  it("resolves a valid suggestion into a real link", () => {
    const result = attachAiSuggestedLinks(1, [suggestion({})]);
    expect(result[0]).toEqual([
      {
        linkSource: "ai_suggested",
        resourceId: null,
        title: "Explore machine learning courses",
        url: "https://www.coursera.org/search?query=machine%20learning",
        provider: "Coursera",
        kind: "course",
      },
    ]);
  });

  it("drops a suggestion naming an unknown provider", () => {
    const result = attachAiSuggestedLinks(1, [
      suggestion({ provider: "some random exam board" }),
    ]);
    expect(result[0]).toEqual([]);
  });

  it("drops a suggestion pointing outside the milestone array", () => {
    const result = attachAiSuggestedLinks(1, [suggestion({ milestoneIndex: 5 })]);
    expect(result[0]).toEqual([]);
  });

  it("drops a suggestion with a negative milestone index", () => {
    const result = attachAiSuggestedLinks(1, [suggestion({ milestoneIndex: -1 })]);
    expect(result[0]).toEqual([]);
  });

  it("caps suggestions per milestone", () => {
    const many = Array.from({ length: 5 }, () => suggestion({}));
    const result = attachAiSuggestedLinks(1, many);
    expect(result[0]).toHaveLength(2);
  });

  it("caps the total across all milestones", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      suggestion({ milestoneIndex: i % 4 }),
    );
    const result = attachAiSuggestedLinks(4, many);
    const total = result.reduce((sum, links) => sum + links.length, 0);
    expect(total).toBeLessThanOrEqual(6);
  });

  it("distributes independently across milestones", () => {
    const result = attachAiSuggestedLinks(2, [
      suggestion({ milestoneIndex: 0, label: "For milestone 0" }),
      suggestion({ milestoneIndex: 1, label: "For milestone 1" }),
    ]);
    expect(result[0][0].title).toBe("For milestone 0");
    expect(result[1][0].title).toBe("For milestone 1");
  });
});
