/**
 * Resource kinds and the copy that has to travel with an unverified entry
 * (PRD 5.9).
 */

export const RESOURCE_KINDS = [
  { value: "syllabus", label: "Syllabus" },
  { value: "scheme", label: "Scheme" },
  { value: "question_paper", label: "Question paper" },
  { value: "course", label: "Course" },
  { value: "certification", label: "Certification" },
  { value: "exam", label: "Exam" },
  { value: "workshop", label: "Workshop" },
  { value: "book", label: "Book" },
  { value: "video", label: "Video" },
  { value: "tool", label: "Tool" },
  { value: "other", label: "Other" },
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number]["value"];

export const RESOURCE_KIND_VALUES = RESOURCE_KINDS.map((k) => k.value) as [
  ResourceKind,
  ...ResourceKind[],
];

const KIND_LABELS: Record<string, string> = Object.fromEntries(
  RESOURCE_KINDS.map((k) => [k.value, k.label]),
);

export function resourceKindLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return KIND_LABELS[value] ?? value;
}

/**
 * Shown on every resource an administrator has not checked.
 *
 * PRD 5.9 requires unverified entries to be visibly marked, and the reason is
 * worth stating plainly: this portal links out to the wider internet, and a
 * link nobody has opened is a claim nobody has stood behind. Defined here so
 * the catalogue, the recommendations, and any export all say the same thing.
 */
export const UNVERIFIED_NOTICE =
  "Not yet checked by an administrator — the link and its details have not " +
  "been confirmed.";

export const VERIFIED_NOTICE =
  "An administrator has opened this link and confirmed its details.";

/**
 * What a resource costs — as three states, not two.
 *
 * `resources.is_free` is a *nullable* boolean, and the NULL is load-bearing:
 * it means "nobody has recorded this", which is a different fact from "this
 * costs money". Collapsing the two would have the portal assert a price it was
 * never told, which is the same fabricated-metadata problem the verified badge
 * exists to prevent — just applied to cost instead of to the link.
 *
 * Defined once here because three states are easy to reduce back to two by
 * accident. Every surface that shows cost — the catalogue card, the roadmap
 * course shelf, the admin list — goes through this function, so the third
 * state cannot quietly disappear from one of them.
 */
export type CostTone = "free" | "paid" | "unknown";

export function costLabel(isFree: boolean | null | undefined): {
  label: string;
  tone: CostTone;
} {
  if (isFree === true) return { label: "Free", tone: "free" };
  if (isFree === false) return { label: "Paid", tone: "paid" };
  return { label: "Cost not recorded", tone: "unknown" };
}

export const COST_UNKNOWN_NOTICE =
  "Nobody has recorded whether this is free or paid. Check on the provider's " +
  "own page before you commit to anything.";

/** The tri-state control's options, shared by the admin form and its parser. */
export const COST_OPTIONS = [
  { value: "unknown", label: "Cost not recorded" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
] as const;

export type CostChoice = (typeof COST_OPTIONS)[number]["value"];

/** Form value → column value. `unknown` is NULL, never `false`. */
export function costChoiceToIsFree(choice: CostChoice): boolean | null {
  if (choice === "free") return true;
  if (choice === "paid") return false;
  return null;
}

/** Column value → form value, for rendering the edit form. */
export function isFreeToCostChoice(isFree: boolean | null | undefined): CostChoice {
  if (isFree === true) return "free";
  if (isFree === false) return "paid";
  return "unknown";
}
