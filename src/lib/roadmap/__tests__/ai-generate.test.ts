import { describe, expect, it } from "vitest";
import { createAnthropicGenerator, type AnthropicLikeClient } from "../ai-generate";
import { generateWithFallback } from "../provider";
import type { RoadmapInput } from "../generate";

/**
 * `createAnthropicGenerator` never touches the network in this suite — every
 * test hands in a plain object shaped like `AnthropicLikeClient`, consistent
 * with this codebase's dependency-injection convention (no `vi.mock`
 * anywhere). What is under test is the validation pipeline around the model's
 * response, not the model itself — asserting exact AI output would test the
 * fake, not the design.
 */

const input: RoadmapInput = {
  departmentName: "Computer Science and Engineering",
  semester: 2,
  goals: ["IT / Software employment"],
  domains: ["Artificial Intelligence & ML"],
  interests: ["Programming"],
  tenthPercentage: 88,
  twelfthPercentage: 82,
  verifiedAchievements: 1,
};

function clientReturning(toolInput: unknown): AnthropicLikeClient {
  return {
    messages: {
      async create() {
        return {
          content: [{ type: "tool_use", name: "submit_roadmap", input: toolInput }],
        };
      },
    },
  };
}

function clientThrowing(error: unknown): AnthropicLikeClient {
  return {
    messages: {
      async create() {
        throw error;
      },
    },
  };
}

const wellFormed = {
  milestones: [
    {
      horizon: "thirty_days",
      title: "Build a small end-to-end project",
      rationale: "This supports your goal of IT / Software employment.",
    },
    {
      horizon: "three_to_six_months",
      title: "Go deeper on a language you enjoy",
      detail: "Pick one you can stick with for a few months.",
      rationale: "This grows the Programming interest you told us about.",
    },
    {
      horizon: "one_to_four_years",
      title: "Specialise toward your chosen domain",
      rationale: "This builds on your work in Artificial Intelligence & ML.",
    },
  ],
  linkSuggestions: [
    {
      milestoneIndex: 0,
      provider: "coursera",
      keyword: "data structures",
      kind: "course",
      label: "Explore data structures courses",
    },
  ],
};

describe("createAnthropicGenerator — well-formed response", () => {
  it("returns a roadmap tagged as AI-sourced, with all milestones and links intact", async () => {
    const generator = createAnthropicGenerator(clientReturning(wellFormed));
    expect(generator.source).toBe("ai");
    expect(generator.provider).toBe("anthropic");

    const result = await generator.generate(input);
    expect(result.milestones).toHaveLength(3);
    expect(result.milestones.map((m) => m.horizon).sort()).toEqual(
      ["one_to_four_years", "thirty_days", "three_to_six_months"].sort(),
    );
    expect(result.linkSuggestions).toHaveLength(1);
    expect(result.linkSuggestions![0]).toMatchObject({
      milestoneIndex: 0,
      provider: "coursera",
    });
  });
});

describe("createAnthropicGenerator — invents nothing", () => {
  it("drops a milestone naming a company or course, keeping its siblings", async () => {
    const response = {
      milestones: [
        {
          horizon: "thirty_days",
          title: "Sign up for a Coursera course",
          rationale: "This supports your goal of IT / Software employment.",
        },
        {
          horizon: "thirty_days",
          title: "Set up a personal project repository",
          rationale: "This supports your goal of IT / Software employment.",
        },
        {
          horizon: "three_to_six_months",
          title: "Go deeper on a language you enjoy",
          rationale: "This grows the Programming interest you told us about.",
        },
        {
          horizon: "one_to_four_years",
          title: "Specialise toward your chosen domain",
          rationale: "This builds on your work in Artificial Intelligence & ML.",
        },
      ],
      linkSuggestions: [],
    };

    const generator = createAnthropicGenerator(clientReturning(response));
    const result = await generator.generate(input);

    expect(result.milestones).toHaveLength(3);
    expect(result.milestones.some((m) => m.title.includes("Coursera"))).toBe(false);
    expect(
      result.milestones.some((m) => m.title === "Set up a personal project repository"),
    ).toBe(true);
  });

  it("drops a milestone quoting a salary or placement statistic", async () => {
    const response = {
      milestones: [
        {
          horizon: "thirty_days",
          title: "Aim for a ₹10 LPA package",
          rationale: "This supports your goal of IT / Software employment.",
        },
        {
          horizon: "thirty_days",
          title: "Set up a personal project repository",
          rationale: "This supports your goal of IT / Software employment.",
        },
        {
          horizon: "three_to_six_months",
          title: "Go deeper on a language you enjoy",
          rationale: "This grows the Programming interest you told us about.",
        },
        {
          horizon: "one_to_four_years",
          title: "Specialise toward your chosen domain",
          rationale: "This builds on your work in Artificial Intelligence & ML.",
        },
      ],
      linkSuggestions: [],
    };

    const generator = createAnthropicGenerator(clientReturning(response));
    const result = await generator.generate(input);
    expect(result.milestones).toHaveLength(3);
    expect(result.milestones.some((m) => m.title.includes("LPA"))).toBe(false);
  });

  it("drops a milestone whose rationale is not grounded in the student's own inputs", async () => {
    const response = {
      milestones: [
        {
          horizon: "thirty_days",
          title: "Do something unrelated",
          rationale: "Everyone should try this regardless of their situation.",
        },
        {
          horizon: "thirty_days",
          title: "Set up a personal project repository",
          rationale: "This supports your goal of IT / Software employment.",
        },
        {
          horizon: "three_to_six_months",
          title: "Go deeper on a language you enjoy",
          rationale: "This grows the Programming interest you told us about.",
        },
        {
          horizon: "one_to_four_years",
          title: "Specialise toward your chosen domain",
          rationale: "This builds on your work in Artificial Intelligence & ML.",
        },
      ],
      linkSuggestions: [],
    };

    const generator = createAnthropicGenerator(clientReturning(response));
    const result = await generator.generate(input);
    expect(result.milestones).toHaveLength(3);
    expect(result.milestones.some((m) => m.title === "Do something unrelated")).toBe(
      false,
    );
  });

  it("re-points a surviving link suggestion at the sanitized milestone index", async () => {
    const response = {
      milestones: [
        {
          horizon: "thirty_days",
          title: "Do something unrelated",
          rationale: "Everyone should try this regardless of their situation.",
        },
        {
          horizon: "thirty_days",
          title: "Set up a personal project repository",
          rationale: "This supports your goal of IT / Software employment.",
        },
        {
          horizon: "three_to_six_months",
          title: "Go deeper on a language you enjoy",
          rationale: "This grows the Programming interest you told us about.",
        },
        {
          horizon: "one_to_four_years",
          title: "Specialise toward your chosen domain",
          rationale: "This builds on your work in Artificial Intelligence & ML.",
        },
      ],
      // Points at index 1 ("Set up a personal project repository"), which
      // survives and shifts to index 0 once index 0 is dropped.
      linkSuggestions: [
        {
          milestoneIndex: 1,
          provider: "coursera",
          keyword: "git",
          kind: "course",
          label: "Learn version control",
        },
        // Points at the dropped milestone — must not survive under any index.
        { milestoneIndex: 0, provider: "coursera", keyword: "unused", kind: "course", label: "Unused link" },
      ],
    };

    const generator = createAnthropicGenerator(clientReturning(response));
    const result = await generator.generate(input);
    expect(result.milestones[0].title).toBe("Set up a personal project repository");
    expect(result.linkSuggestions).toHaveLength(1);
    expect(result.linkSuggestions![0]).toMatchObject({ milestoneIndex: 0, keyword: "git" });
  });
});

describe("createAnthropicGenerator — fails closed", () => {
  it("throws when dropping milestones empties a horizon", async () => {
    const response = {
      milestones: [
        {
          horizon: "thirty_days",
          title: "Sign up for a Coursera course",
          rationale: "This supports your goal of IT / Software employment.",
        },
        {
          horizon: "three_to_six_months",
          title: "Go deeper on a language you enjoy",
          rationale: "This grows the Programming interest you told us about.",
        },
        {
          horizon: "one_to_four_years",
          title: "Specialise toward your chosen domain",
          rationale: "This builds on your work in Artificial Intelligence & ML.",
        },
      ],
      linkSuggestions: [],
    };

    const generator = createAnthropicGenerator(clientReturning(response));
    await expect(generator.generate(input)).rejects.toThrow();
  });

  it("throws when the model does not call submit_roadmap", async () => {
    const client: AnthropicLikeClient = {
      messages: {
        async create() {
          return { content: [{ type: "text" }] };
        },
      },
    };
    const generator = createAnthropicGenerator(client);
    await expect(generator.generate(input)).rejects.toThrow();
  });

  it("throws when the tool input fails schema validation", async () => {
    const generator = createAnthropicGenerator(clientReturning({ milestones: "not an array" }));
    await expect(generator.generate(input)).rejects.toThrow();
  });

  it("throws when the client itself throws (timeout or network error)", async () => {
    const generator = createAnthropicGenerator(clientThrowing(new Error("timeout")));
    await expect(generator.generate(input)).rejects.toThrow("timeout");
  });
});

describe("generateWithFallback — the safety net", () => {
  it("falls back to a valid rule-based roadmap when the AI generator throws", async () => {
    const failingAiGenerator = createAnthropicGenerator(clientThrowing(new Error("boom")));

    const { roadmap, generator } = await generateWithFallback(input, failingAiGenerator);

    expect(generator.source).toBe("rule_based");
    expect(roadmap.milestones.length).toBeGreaterThan(0);
    for (const m of roadmap.milestones) {
      expect(m.rationale.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns the AI roadmap unchanged when it succeeds", async () => {
    const workingAiGenerator = createAnthropicGenerator(clientReturning(wellFormed));

    const { roadmap, generator } = await generateWithFallback(input, workingAiGenerator);

    expect(generator.source).toBe("ai");
    expect(roadmap.milestones).toHaveLength(3);
  });
});
