/**
 * A whitelist of link providers the AI roadmap generator may cite (PRD 5.10,
 * MANUAL-STEPS.md 3.4).
 *
 * This is the mechanism that lets the AI-generated roadmap point at concrete
 * exams, workshops, and certifications without ever letting the model emit a
 * URL itself. The model's structured output (`ai-schema.ts`) has no `url`
 * field at all — it can only name a `provider` and a `keyword`. Everything in
 * this file is pure and deterministic: given the same provider name and
 * keyword, it always builds the same, real link, or refuses (`null`) rather
 * than guessing.
 *
 * Two kinds of provider:
 *
 *   - `search`  — a stable search page on a real domain, with the keyword
 *     dropped into its query string. The result is always a working page on
 *     that domain, even if the search itself comes up empty.
 *   - `fixed`   — a single landing page with no query string at all, for
 *     providers whose actual programme catalogue is not something a URL
 *     template can address (AWS/Google/Microsoft's certification browsers,
 *     HackerRank's verification hub).
 *
 * GATE and other government/board exams are deliberately **not** on this
 * list. Their host domain changes with the exam cycle, so a hardcoded
 * template would eventually point somewhere stale or wrong — worse than no
 * link. Time-bound exam links belong in the admin-verified `resources`
 * catalogue (PRD 5.9), where a person updates them each cycle.
 */

export type ProviderKey =
  | "nptel"
  | "swayam"
  | "coursera"
  | "edx"
  | "udemy"
  | "aws_certification"
  | "google_certificates"
  | "microsoft_certifications"
  | "linkedin_learning"
  | "hackerrank"
  | "cisco_netacad"
  | "aws_skill_builder"
  | "ibm_skillsbuild"
  | "infosys_springboard"
  | "github_skills"
  | "microsoft_learn"
  | "google_developers"
  | "kaggle_learn";

type SearchProvider = {
  key: ProviderKey;
  type: "search";
  label: string;
  aliases: string[];
  buildUrl: (keyword: string) => string;
};

type FixedProvider = {
  key: ProviderKey;
  type: "fixed";
  label: string;
  aliases: string[];
  url: string;
};

type ProviderDef = SearchProvider | FixedProvider;

const PROVIDERS: ProviderDef[] = [
  {
    key: "nptel",
    type: "search",
    label: "NPTEL",
    aliases: ["nptel", "national programme on technology enhanced learning"],
    buildUrl: (k) =>
      `https://onlinecourses.nptel.ac.in/explorer?search=${encodeURIComponent(k)}`,
  },
  {
    key: "swayam",
    type: "search",
    label: "SWAYAM",
    aliases: ["swayam"],
    buildUrl: (k) => `https://swayam.gov.in/explorer?searchText=${encodeURIComponent(k)}`,
  },
  {
    key: "coursera",
    type: "search",
    label: "Coursera",
    aliases: ["coursera"],
    buildUrl: (k) => `https://www.coursera.org/search?query=${encodeURIComponent(k)}`,
  },
  {
    key: "edx",
    type: "search",
    label: "edX",
    aliases: ["edx"],
    buildUrl: (k) => `https://www.edx.org/search?q=${encodeURIComponent(k)}`,
  },
  {
    key: "udemy",
    type: "search",
    label: "Udemy",
    aliases: ["udemy"],
    buildUrl: (k) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(k)}`,
  },
  {
    key: "aws_certification",
    type: "fixed",
    label: "AWS Certification",
    aliases: ["aws", "amazon web services", "aws certification", "amazon"],
    url: "https://aws.amazon.com/certification/",
  },
  {
    key: "google_certificates",
    type: "fixed",
    label: "Google Career Certificates",
    aliases: ["google", "google certificates", "google career certificates"],
    url: "https://grow.google/certificates/",
  },
  {
    key: "microsoft_certifications",
    type: "fixed",
    label: "Microsoft Certifications",
    aliases: ["microsoft", "microsoft certifications", "microsoft learn"],
    url: "https://learn.microsoft.com/en-us/credentials/certifications/browse/",
  },
  {
    key: "linkedin_learning",
    type: "search",
    label: "LinkedIn Learning",
    aliases: ["linkedin", "linkedin learning"],
    buildUrl: (k) =>
      `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(k)}`,
  },
  {
    key: "hackerrank",
    type: "fixed",
    label: "HackerRank Skills Verification",
    aliases: ["hackerrank", "hackerrank skills verification"],
    url: "https://www.hackerrank.com/skills-verification",
  },
  // Added for the career pathway timeline. All eight are `fixed` rather than
  // `search`: unlike nptel/coursera/edx/udemy/linkedin, whose query-string
  // search formats are well documented and stable, these platforms' own
  // search behaviour is either app-gated (Springboard), single-catalogue-page
  // (GitHub Skills, Kaggle Learn, Cisco NetAcad), or not confidently
  // verifiable — landing on a real, working page beats guessing a query
  // parameter that might silently 404.
  {
    key: "cisco_netacad",
    type: "fixed",
    label: "Cisco Networking Academy",
    aliases: ["cisco", "cisco networking academy", "netacad"],
    url: "https://www.netacad.com/courses/all-courses",
  },
  {
    key: "aws_skill_builder",
    type: "fixed",
    label: "AWS Skill Builder",
    aliases: ["aws skill builder", "skill builder"],
    url: "https://skillbuilder.aws/",
  },
  {
    key: "ibm_skillsbuild",
    type: "fixed",
    label: "IBM SkillsBuild",
    aliases: ["ibm", "ibm skillsbuild", "skillsbuild"],
    url: "https://skillsbuild.org/",
  },
  {
    key: "infosys_springboard",
    type: "fixed",
    label: "Infosys Springboard",
    aliases: ["infosys", "infosys springboard", "springboard"],
    url: "https://infyspringboard.onwingspan.com/",
  },
  {
    key: "github_skills",
    type: "fixed",
    label: "GitHub Skills",
    aliases: ["github", "github skills"],
    url: "https://skills.github.com/",
  },
  {
    // Deliberately distinct label/aliases from `microsoft_certifications`
    // above ("microsoft", "microsoft learn") so a bare "Microsoft Learn"
    // keeps resolving to the certifications landing page exactly as before —
    // this is the training-catalogue search, reached only by its own,
    // unambiguous name.
    key: "microsoft_learn",
    type: "search",
    label: "Microsoft Learn Training",
    aliases: ["microsoft learn training", "ms learn"],
    buildUrl: (k) => `https://learn.microsoft.com/en-us/training/browse/?terms=${encodeURIComponent(k)}`,
  },
  {
    key: "google_developers",
    type: "fixed",
    label: "Google for Developers",
    aliases: ["google for developers", "google developers"],
    url: "https://developers.google.com/",
  },
  {
    key: "kaggle_learn",
    type: "fixed",
    label: "Kaggle Learn",
    aliases: ["kaggle", "kaggle learn"],
    url: "https://www.kaggle.com/learn",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    // Dots are dropped rather than turned into a separator, so a dotted
    // acronym like "N.P.T.E.L" collapses to "nptel" instead of splintering
    // into five single-letter words that can never match the "nptel" alias.
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `needle` appears in `haystack` as whole word(s), not a fragment. */
function containsWhole(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(needle)}($|\\s)`).test(haystack);
}

/**
 * Matches free-text the model wrote against the whitelist above.
 *
 * Tries an exact match on the label or an alias first, then falls back to a
 * whole-word/whole-phrase match so "AWS certification track" still resolves
 * to `aws_certification`. Aliases shorter than 3 characters are excluded from
 * the fallback so a short string cannot cause an accidental match. No match
 * at any stage returns `null` — this function never guesses.
 */
function resolveProvider(providerText: string): ProviderDef | null {
  const norm = normalize(providerText);
  if (norm.length === 0) return null;

  for (const provider of PROVIDERS) {
    if (normalize(provider.label) === norm) return provider;
    for (const alias of provider.aliases) {
      if (normalize(alias) === norm) return provider;
    }
  }

  for (const provider of PROVIDERS) {
    for (const alias of provider.aliases) {
      const na = normalize(alias);
      if (na.length >= 3 && containsWhole(norm, na)) return provider;
    }
  }

  return null;
}

export type ProviderLink = {
  provider: ProviderKey;
  providerLabel: string;
  url: string;
};

/**
 * Builds a real, working link from a provider name and a search keyword —
 * both supplied by the model, neither of which is ever a URL.
 *
 * Fails closed at every step: an unrecognised provider, or a blank keyword
 * for a provider that needs one to produce a useful page, returns `null`
 * rather than a generic fallback link. The caller (`links.ts`) drops the
 * suggestion when this happens; it never substitutes something else.
 */
export function buildProviderLink(
  providerText: string,
  keyword: string,
): ProviderLink | null {
  const provider = resolveProvider(providerText);
  if (!provider) return null;

  if (provider.type === "fixed") {
    return { provider: provider.key, providerLabel: provider.label, url: provider.url };
  }

  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword.length === 0) return null;

  return {
    provider: provider.key,
    providerLabel: provider.label,
    url: provider.buildUrl(trimmedKeyword),
  };
}

/** The provider names and a one-line description of each, for the AI prompt. */
export function listProvidersForPrompt(): Array<{
  key: ProviderKey;
  label: string;
  needsKeyword: boolean;
}> {
  return PROVIDERS.map((p) => ({
    key: p.key,
    label: p.label,
    needsKeyword: p.type === "search",
  }));
}
