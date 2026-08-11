/**
 * Student directory filters (PRD 5.5).
 *
 * Pure and dependency-free: the same parsed filter object drives the query,
 * the "applied filters" summary in the UI, and the header of an exported CSV
 * (PRD 5.11 requires an export to state the filters that produced it). Keeping
 * parsing separate from querying is what lets all three agree without the
 * database being involved in a unit test.
 */

import {
  RESIDENCE_FIELD_LABEL,
  RESIDENCE_VALUES,
  residenceLabel,
} from "@/config/residence";

export type CompletionBand = "all" | "complete" | "incomplete";

export type StudentFilters = {
  q: string | null;
  department: string | null;
  semester: number | null;
  section: string | null;
  quota: string | null;
  residenceType: string | null;
  completion: CompletionBand;
  interestId: number | null;
  goalId: number | null;
  domainId: number | null;
  minTenth: number | null;
  minTwelfth: number | null;
  page: number;
};

export const PAGE_SIZE = 25;

export const EMPTY_FILTERS: StudentFilters = {
  q: null,
  department: null,
  semester: null,
  section: null,
  quota: null,
  residenceType: null,
  completion: "all",
  interestId: null,
  goalId: null,
  domainId: null,
  minTenth: null,
  minTwelfth: null,
  page: 1,
};

const VALID_QUOTAS = new Set([
  "cet",
  "comedk",
  "management",
  "jee",
  "diploma_lateral",
  "other",
]);
const VALID_RESIDENCE = new Set<string>(RESIDENCE_VALUES);

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(raw: RawParams, key: string): string | null {
  const value = raw[key];
  const single = Array.isArray(value) ? value[0] : value;
  if (single === undefined) return null;
  const trimmed = single.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toInt(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function toNumber(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function oneOf(value: string | null, allowed: Set<string>): string | null {
  if (value === null) return null;
  return allowed.has(value) ? value : null;
}

/**
 * Parses URL search params into a filter object.
 *
 * Anything unrecognised is dropped rather than passed through — these values
 * reach a database query, so an unvalidated value is not a UI bug waiting to
 * happen, it is an injection surface.
 */
export function parseFilters(raw: RawParams): StudentFilters {
  const completionRaw = firstValue(raw, "completion");
  const completion: CompletionBand =
    completionRaw === "complete" || completionRaw === "incomplete"
      ? completionRaw
      : "all";

  return {
    q: firstValue(raw, "q"),
    department: firstValue(raw, "department"),
    semester: toInt(firstValue(raw, "semester"), 1, 2),
    section: firstValue(raw, "section")?.toUpperCase() ?? null,
    quota: oneOf(firstValue(raw, "quota"), VALID_QUOTAS),
    residenceType: oneOf(firstValue(raw, "residence"), VALID_RESIDENCE),
    completion,
    interestId: toInt(firstValue(raw, "interest"), 1, Number.MAX_SAFE_INTEGER),
    goalId: toInt(firstValue(raw, "goal"), 1, Number.MAX_SAFE_INTEGER),
    domainId: toInt(firstValue(raw, "domain"), 1, Number.MAX_SAFE_INTEGER),
    minTenth: toNumber(firstValue(raw, "minTenth"), 0, 100),
    minTwelfth: toNumber(firstValue(raw, "minTwelfth"), 0, 100),
    page: toInt(firstValue(raw, "page"), 1, 10_000) ?? 1,
  };
}

/** True when nothing beyond the default page is set. */
export function hasActiveFilters(filters: StudentFilters): boolean {
  return (
    filters.q !== null ||
    filters.department !== null ||
    filters.semester !== null ||
    filters.section !== null ||
    filters.quota !== null ||
    filters.residenceType !== null ||
    filters.completion !== "all" ||
    filters.interestId !== null ||
    filters.goalId !== null ||
    filters.domainId !== null ||
    filters.minTenth !== null ||
    filters.minTwelfth !== null
  );
}

export type LookupName = (kind: "interest" | "goal" | "domain", id: number) => string;

/**
 * Human-readable summary of what is currently filtered. Used above the
 * results table and repeated in the CSV header so an exported file can always
 * be traced back to the query that produced it.
 */
export function describeFilters(
  filters: StudentFilters,
  lookupName?: LookupName,
): string[] {
  const parts: string[] = [];
  const name = (kind: "interest" | "goal" | "domain", id: number) =>
    lookupName ? lookupName(kind, id) : `#${id}`;

  if (filters.q) parts.push(`Search: "${filters.q}"`);
  if (filters.department) parts.push(`Department: ${filters.department}`);
  if (filters.semester) parts.push(`Semester: ${filters.semester}`);
  if (filters.section) parts.push(`Section: ${filters.section}`);
  if (filters.quota) parts.push(`Quota: ${filters.quota}`);
  if (filters.residenceType) {
    parts.push(
      `${RESIDENCE_FIELD_LABEL}: ${residenceLabel(filters.residenceType)}`,
    );
  }
  if (filters.completion === "complete") parts.push("Profile: 100% complete");
  if (filters.completion === "incomplete") parts.push("Profile: incomplete");
  if (filters.interestId) {
    parts.push(`Interest: ${name("interest", filters.interestId)}`);
  }
  if (filters.goalId) parts.push(`Goal: ${name("goal", filters.goalId)}`);
  if (filters.domainId) parts.push(`Domain: ${name("domain", filters.domainId)}`);
  if (filters.minTenth !== null) parts.push(`10th ≥ ${filters.minTenth}%`);
  if (filters.minTwelfth !== null) parts.push(`12th ≥ ${filters.minTwelfth}%`);

  return parts;
}

/** Rebuilds a query string, dropping defaults so URLs stay readable. */
export function filtersToSearchParams(
  filters: StudentFilters,
  overrides: Partial<StudentFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.q) params.set("q", merged.q);
  if (merged.department) params.set("department", merged.department);
  if (merged.semester) params.set("semester", String(merged.semester));
  if (merged.section) params.set("section", merged.section);
  if (merged.quota) params.set("quota", merged.quota);
  if (merged.residenceType) params.set("residence", merged.residenceType);
  if (merged.completion !== "all") params.set("completion", merged.completion);
  if (merged.interestId) params.set("interest", String(merged.interestId));
  if (merged.goalId) params.set("goal", String(merged.goalId));
  if (merged.domainId) params.set("domain", String(merged.domainId));
  if (merged.minTenth !== null) params.set("minTenth", String(merged.minTenth));
  if (merged.minTwelfth !== null) {
    params.set("minTwelfth", String(merged.minTwelfth));
  }
  if (merged.page > 1) params.set("page", String(merged.page));

  return params.toString();
}

// --- CSV --------------------------------------------------------------------

/**
 * Escapes a CSV cell.
 *
 * The leading apostrophe on =, +, -, @ is deliberate: Excel and Sheets treat
 * a cell starting with those as a formula, so an unescaped value becomes a
 * CSV-injection vector in an export that faculty are expected to open.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
