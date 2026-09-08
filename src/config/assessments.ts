/**
 * Assessment kinds, question types, and the copy that has to travel with
 * them (PRD 5.7).
 *
 * Defined once and imported by the builder, the sitting screen, the results
 * view, and the CSV export — the same reasoning as `config/residence.ts`.
 * Enums in the database, labels here.
 */

export const ASSESSMENT_KINDS = [
  {
    value: "general",
    label: "General",
    hint: "Subject or skills test, marked against correct answers.",
  },
  {
    value: "english",
    label: "English",
    hint: "Section-wise language assessment.",
  },
  {
    value: "psychometric",
    label: "Psychometric",
    hint: "Self-development only. Results reach the student and their mentor.",
  },
] as const;

export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number]["value"];

export const ASSESSMENT_KIND_VALUES = ASSESSMENT_KINDS.map((k) => k.value) as [
  AssessmentKind,
  ...AssessmentKind[],
];

export const QUESTION_KINDS = [
  { value: "single_choice", label: "Single choice", objective: true },
  { value: "multiple_choice", label: "Multiple choice", objective: true },
  { value: "true_false", label: "True / false", objective: true },
  { value: "likert", label: "Likert scale", objective: false },
  { value: "short_answer", label: "Short answer", objective: false },
  { value: "long_answer", label: "Long answer", objective: false },
] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number]["value"];

export const QUESTION_KIND_VALUES = QUESTION_KINDS.map((q) => q.value) as [
  QuestionKind,
  ...QuestionKind[],
];

/** Question types the machine can mark without a human reading them. */
const OBJECTIVE_KINDS = new Set<string>(
  QUESTION_KINDS.filter((q) => q.objective).map((q) => q.value),
);

export function isObjective(kind: string): boolean {
  return OBJECTIVE_KINDS.has(kind);
}

/** Question types that carry options rather than free text. */
export function hasOptions(kind: string): boolean {
  return kind !== "short_answer" && kind !== "long_answer";
}

export type AttemptStatus =
  | "in_progress"
  | "submitted"
  | "graded"
  | "abandoned";

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  in_progress: "In progress",
  submitted: "Awaiting marking",
  graded: "Marked",
  abandoned: "Abandoned",
};

const KIND_LABELS: Record<string, string> = Object.fromEntries(
  ASSESSMENT_KINDS.map((k) => [k.value, k.label]),
);
const QUESTION_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_KINDS.map((q) => [q.value, q.label]),
);

export function assessmentKindLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return KIND_LABELS[value] ?? value;
}

export function questionKindLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return QUESTION_LABELS[value] ?? value;
}

export function attemptStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ATTEMPT_STATUS_LABELS[value as AttemptStatus] ?? value;
}

/**
 * The disclosure that must accompany every psychometric assessment.
 *
 * This is a product requirement, not optional copy (PRD 5.7 and the non-goals
 * in section 2). It is defined here so the sitting screen, the results view,
 * and any export all state the same thing, and so removing it from one place
 * is a visible deletion rather than an omission nobody notices.
 */
export const PSYCHOMETRIC_DISCLOSURE =
  "This questionnaire is for self-development and mentoring only. It is " +
  "indicative, not a clinical or medical assessment, and it is never used " +
  "as a basis for denying you any opportunity. Your results are visible to " +
  "you and your assigned mentor.";

/** Shown before a psychometric attempt can be started. */
export const PSYCHOMETRIC_CONSENT =
  "I understand these results are indicative, are for my own development, " +
  "and will be shared only with my assigned mentor.";

/**
 * The six areas a first-year employability profile usually names, and what
 * each actually covers. Static copy, not a claim about the student — the
 * numbers behind it (self-reported scores, assessment attempts) come from
 * elsewhere and are attached to a category id, never invented here.
 */
export const SKILL_CATEGORIES = [
  {
    id: "aptitude",
    label: "Aptitude",
    covers: "Quantitative aptitude, numerical ability, analytical thinking.",
  },
  {
    id: "logical_reasoning",
    label: "Logical Reasoning",
    covers: "Patterns, puzzles, decision-making, problem solving.",
  },
  {
    id: "technical",
    label: "Technical Aptitude",
    covers:
      "Basic programming logic, computational thinking, technology awareness.",
  },
  {
    id: "communication",
    label: "Communication Skills",
    covers: "Vocabulary, comprehension, professional communication.",
  },
  {
    id: "soft_skills",
    label: "Soft Skills",
    covers: "Teamwork, leadership, adaptability, time management.",
  },
  {
    id: "personality",
    label: "Personality Assessment",
    covers:
      "Working style, collaboration, initiative, learning preferences.",
  },
] as const;

export type SkillCategoryId = (typeof SKILL_CATEGORIES)[number]["id"];

export const SKILL_CATEGORY_VALUES = SKILL_CATEGORIES.map((c) => c.id) as [
  SkillCategoryId,
  ...SkillCategoryId[],
];

/**
 * Real homepages, not fabricated deep links. This app does not know which
 * specific NPTEL course or Springboard path fits a given student, so it sends
 * them to the platform's own front door rather than guessing a URL.
 */
export const EXTERNAL_PLATFORMS = [
  {
    id: "nptel",
    label: "NPTEL",
    url: "https://nptel.ac.in",
    hint: "Free technical courses with certification exams.",
  },
  {
    id: "infosys_springboard",
    label: "Infosys Springboard",
    url: "https://infyspringboard.onwingspan.com",
    hint: "Free courses and skill assessments across most of the six areas above.",
  },
] as const;

/**
 * Shown on every self-reported external score, next to the number itself —
 * never left to be inferred from context. A score a student typed in is not
 * the same fact as a score this portal graded, and the two must never look
 * alike on screen.
 */
export const SELF_REPORTED_NOTICE = "Self-reported — not verified.";

/**
 * The bands a percentage is reported in.
 *
 * Every band carries a `label`, and the label is what the UI must render —
 * colour alone is not a way to tell a student how they did, because a
 * colour-blind reader, a printed page, and a screen reader all lose it. The
 * `tone` is decoration on top of the words, never instead of them.
 *
 * Ordered low to high, and exhaustive over 0-100 with no gap between bands,
 * so `performanceLevel` can never fall through.
 */
export const PERFORMANCE_LEVELS = [
  { id: "needs_improvement", label: "Needs Improvement", min: 0,  max: 39,  tone: "danger" },
  { id: "developing",        label: "Developing",        min: 40, max: 59,  tone: "warn" },
  { id: "good",              label: "Good",              min: 60, max: 74,  tone: "info" },
  { id: "strong",            label: "Strong",            min: 75, max: 89,  tone: "success" },
  { id: "excellent",         label: "Excellent",         min: 90, max: 100, tone: "success" },
] as const;

export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number];

/**
 * The one category that is never scored.
 *
 * A personality questionnaire has no right answers, so it has no percentage,
 * no pass mark, and no place on the skill radar. It reports completion and
 * nothing else — the rule PSYCHOMETRIC_DISCLOSURE states in words, held here
 * in a form the code can actually obey.
 */
export const UNSCORED_CATEGORY_ID = "personality";

/** The five areas that do carry a percentage, in radar order. */
export const SCORED_CATEGORY_IDS = SKILL_CATEGORIES.filter(
  (c) => c.id !== UNSCORED_CATEGORY_ID,
).map((c) => c.id);

/**
 * Optional outside practice, offered as practice and labelled as such.
 *
 * Every URL was fetched and returned 200 when it was added. None of these
 * sites reports back to this portal, so nothing a student scores on them
 * arrives here on its own — they can record it by hand under "Add external
 * result", where it stays marked self-reported until a faculty member
 * verifies it. Claiming these sync would be the easiest lie on the page.
 */
export const EXTERNAL_PRACTICE: ReadonlyArray<{
  categoryId: SkillCategoryId;
  label: string;
  url: string;
  provider: string;
}> = [
  {
    categoryId: "aptitude",
    label: "Try External Aptitude Practice",
    url: "https://trainthinking.com/ccat-practice-test/",
    provider: "TrainThinking",
  },
  {
    categoryId: "logical_reasoning",
    label: "Try External Logical Reasoning Test",
    url: "https://trainthinking.com/logical-reasoning-test/",
    provider: "TrainThinking",
  },
  {
    // The British Council India page given for this refused every request
    // made to it, so the link points at EnglishScore's own site instead —
    // the same test, from the people who run it, and a URL that resolves.
    categoryId: "communication",
    label: "Take the EnglishScore test",
    url: "https://englishscore.com/",
    provider: "EnglishScore (British Council)",
  },
  {
    categoryId: "soft_skills",
    label: "Explore Soft Skills Assessments",
    url: "https://risely.me/resources/assessments/",
    provider: "Risely",
  },
  {
    categoryId: "personality",
    label: "Take Personality Assessment",
    url: "https://www.16personalities.com/free-personality-test",
    provider: "16Personalities",
  },
];

/**
 * What has happened to a self-reported external result.
 *
 * The three states are deliberately not collapsible into a boolean. "Nobody
 * has looked at this yet" and "someone looked and rejected it" are different
 * things to show a student, and merging them into "not verified" would let a
 * rejected result sit indefinitely looking merely unreviewed.
 */
export const EXTERNAL_VERIFICATION = [
  {
    id: "self_reported",
    label: "Student submitted — unverified",
    short: "Unverified",
    hint: "You recorded this yourself. No one here has checked it yet.",
  },
  {
    id: "verified",
    label: "Faculty verified",
    short: "Verified",
    hint: "A member of staff has checked this against your certificate.",
  },
  {
    id: "rejected",
    label: "Not accepted",
    short: "Not accepted",
    hint: "A member of staff reviewed this and did not accept it.",
  },
] as const;

export type ExternalVerification = (typeof EXTERNAL_VERIFICATION)[number]["id"];

export const EXTERNAL_VERIFICATION_VALUES = EXTERNAL_VERIFICATION.map(
  (v) => v.id,
) as [ExternalVerification, ...ExternalVerification[]];

export function externalVerificationLabel(value: string | null | undefined) {
  return EXTERNAL_VERIFICATION.find((v) => v.id === value) ?? null;
}
