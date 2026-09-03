import { describe, expect, it } from "vitest";
import { buildProviderLink, listProvidersForPrompt } from "../link-providers";

/**
 * `link-providers.ts` is the sole channel through which an AI-suggested
 * milestone link becomes a real URL. Every assertion here is really an
 * assertion about what a student could end up clicking, so the table below
 * is exhaustive rather than a sample.
 */
describe("buildProviderLink", () => {
  it("builds an NPTEL search URL with the keyword encoded", () => {
    const link = buildProviderLink("nptel", "data structures");
    expect(link).toEqual({
      provider: "nptel",
      providerLabel: "NPTEL",
      url: "https://onlinecourses.nptel.ac.in/explorer?search=data%20structures",
    });
  });

  it("builds a SWAYAM search URL", () => {
    const link = buildProviderLink("swayam", "digital electronics");
    expect(link?.url).toBe(
      "https://swayam.gov.in/explorer?searchText=digital%20electronics",
    );
    expect(link?.provider).toBe("swayam");
  });

  it("builds a Coursera search URL", () => {
    const link = buildProviderLink("coursera", "machine learning");
    expect(link?.url).toBe(
      "https://www.coursera.org/search?query=machine%20learning",
    );
  });

  it("builds an edX search URL", () => {
    const link = buildProviderLink("edx", "python");
    expect(link?.url).toBe("https://www.edx.org/search?q=python");
  });

  it("builds a Udemy search URL", () => {
    const link = buildProviderLink("udemy", "react");
    expect(link?.url).toBe(
      "https://www.udemy.com/courses/search/?q=react",
    );
  });

  it("builds a LinkedIn Learning search URL", () => {
    const link = buildProviderLink("linkedin learning", "public speaking");
    expect(link?.url).toBe(
      "https://www.linkedin.com/learning/search?keywords=public%20speaking",
    );
  });

  it("returns the fixed AWS certification landing page regardless of keyword", () => {
    const link = buildProviderLink("aws", "anything at all");
    expect(link).toEqual({
      provider: "aws_certification",
      providerLabel: "AWS Certification",
      url: "https://aws.amazon.com/certification/",
    });
  });

  it("resolves AWS aliases", () => {
    for (const alias of ["Amazon Web Services", "AWS Certification", "amazon"]) {
      expect(buildProviderLink(alias, "")?.provider).toBe("aws_certification");
    }
  });

  it("returns the fixed Google Career Certificates landing page", () => {
    const link = buildProviderLink("google certificates", "");
    expect(link?.url).toBe("https://grow.google/certificates/");
  });

  it("returns the fixed Microsoft Certifications landing page", () => {
    const link = buildProviderLink("microsoft learn", "");
    expect(link?.url).toBe(
      "https://learn.microsoft.com/en-us/credentials/certifications/browse/",
    );
  });

  it("returns the fixed HackerRank Skills Verification landing page", () => {
    const link = buildProviderLink("hackerrank", "");
    expect(link?.url).toBe("https://www.hackerrank.com/skills-verification");
  });

  it("is case- and punctuation-insensitive", () => {
    expect(buildProviderLink("  NPTEL  ", "os")?.provider).toBe("nptel");
    expect(buildProviderLink("N.P.T.E.L", "os")?.provider).toBe("nptel");
  });

  it("resolves a provider named inside a longer phrase", () => {
    expect(buildProviderLink("an AWS certification track", "")?.provider).toBe(
      "aws_certification",
    );
  });

  it("does not match a short alias as a fragment of an unrelated word", () => {
    // "aws" is 3 chars and allowed as a whole-word fallback match, but must
    // not match inside an unrelated longer word like "jaws" or "awesome".
    expect(buildProviderLink("jaws", "")).toBeNull();
    expect(buildProviderLink("awesome", "")).toBeNull();
  });

  it("encodes special characters in the keyword", () => {
    const link = buildProviderLink("coursera", "C++ & data/algorithms");
    expect(link?.url).toBe(
      `https://www.coursera.org/search?query=${encodeURIComponent("C++ & data/algorithms")}`,
    );
  });

  it("returns null for an unknown provider", () => {
    expect(buildProviderLink("gate", "computer science")).toBeNull();
    expect(buildProviderLink("some made up provider", "x")).toBeNull();
  });

  it("returns null for a blank provider name", () => {
    expect(buildProviderLink("", "keyword")).toBeNull();
    expect(buildProviderLink("   ", "keyword")).toBeNull();
  });

  it("returns null for a search provider given a blank keyword", () => {
    expect(buildProviderLink("nptel", "")).toBeNull();
    expect(buildProviderLink("coursera", "   ")).toBeNull();
  });

  it("returns the fixed Cisco Networking Academy landing page", () => {
    const link = buildProviderLink("cisco", "");
    expect(link).toEqual({
      provider: "cisco_netacad",
      providerLabel: "Cisco Networking Academy",
      url: "https://www.netacad.com/courses/all-courses",
    });
  });

  it("returns the fixed AWS Skill Builder landing page", () => {
    expect(buildProviderLink("aws skill builder", "")?.url).toBe("https://skillbuilder.aws/");
  });

  it("returns the fixed IBM SkillsBuild landing page", () => {
    expect(buildProviderLink("ibm", "")?.url).toBe("https://skillsbuild.org/");
  });

  it("returns the fixed Infosys Springboard landing page", () => {
    expect(buildProviderLink("infosys springboard", "")?.url).toBe(
      "https://infyspringboard.onwingspan.com/",
    );
  });

  it("returns the fixed GitHub Skills landing page", () => {
    expect(buildProviderLink("github skills", "")?.url).toBe("https://skills.github.com/");
  });

  it("returns the fixed Google for Developers landing page", () => {
    expect(buildProviderLink("google for developers", "")?.url).toBe(
      "https://developers.google.com/",
    );
  });

  it("returns the fixed Kaggle Learn landing page", () => {
    expect(buildProviderLink("kaggle", "")?.url).toBe("https://www.kaggle.com/learn");
  });

  it("builds a Microsoft Learn Training search URL, distinct from Microsoft Certifications", () => {
    const training = buildProviderLink("ms learn", "python");
    expect(training?.provider).toBe("microsoft_learn");
    expect(training?.url).toBe(
      "https://learn.microsoft.com/en-us/training/browse/?terms=python",
    );

    // A bare "microsoft learn" must still resolve to the certifications
    // landing page exactly as it did before these providers were added.
    expect(buildProviderLink("microsoft learn", "")?.provider).toBe(
      "microsoft_certifications",
    );
  });

  it("never returns a generic fallback link", () => {
    // Every non-null result must point at one of the whitelisted domains —
    // there is no "default" URL this function can fall back to.
    const allowedHosts = [
      "onlinecourses.nptel.ac.in",
      "swayam.gov.in",
      "www.coursera.org",
      "www.edx.org",
      "www.udemy.com",
      "aws.amazon.com",
      "grow.google",
      "learn.microsoft.com",
      "www.linkedin.com",
      "www.hackerrank.com",
      "www.netacad.com",
      "skillbuilder.aws",
      "skillsbuild.org",
      "infyspringboard.onwingspan.com",
      "skills.github.com",
      "developers.google.com",
      "www.kaggle.com",
    ];
    for (const p of listProvidersForPrompt()) {
      const link = buildProviderLink(p.key, "sample keyword");
      expect(link).not.toBeNull();
      const host = new URL(link!.url).host;
      expect(allowedHosts).toContain(host);
    }
  });
});

describe("listProvidersForPrompt", () => {
  it("lists every provider with whether it needs a keyword", () => {
    const list = listProvidersForPrompt();
    expect(list.length).toBe(18);
    const fixed = list.filter((p) => !p.needsKeyword).map((p) => p.key);
    expect(fixed.sort()).toEqual(
      [
        "aws_certification",
        "google_certificates",
        "microsoft_certifications",
        "hackerrank",
        "cisco_netacad",
        "aws_skill_builder",
        "ibm_skillsbuild",
        "infosys_springboard",
        "github_skills",
        "google_developers",
        "kaggle_learn",
      ].sort(),
    );
  });
});
