/**
 * Pure logic for internal marks (migration 0025).
 *
 * Kept free of Supabase and React for the same reason as
 * `profile-completion.ts`: this is the arithmetic a student will check against
 * their own result sheet, so it needs to be testable without a database.
 */

import type { MarkComponent, MarkEntry } from "@/config/marks";

/**
 * The total of the components actually recorded — never a CIE.
 *
 * Absent and unreleased components are skipped rather than counted as zero,
 * and `outOf` follows the same rule, so the pair always reads as "what is
 * recorded, out of what could have been recorded". Counting a blank as zero
 * would tell a student they scored 22/60 when three papers simply have not
 * been marked yet, which is the single most alarming way to be wrong here.
 */
export function sumRecorded(entries: readonly MarkEntry[]): {
  scored: number;
  outOf: number;
  recordedCount: number;
} {
  let scored = 0;
  let outOf = 0;
  let recordedCount = 0;

  for (const entry of entries) {
    if (entry.marks === null) continue;
    scored += entry.marks;
    outOf += entry.maxMarks;
    recordedCount += 1;
  }

  return { scored: round2(scored), outOf, recordedCount };
}

/** Trims float drift from summing `numeric(5,2)` values. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Only what a student is allowed to see.
 *
 * RLS already withholds unreleased rows, so this is not the security boundary
 * — it is what keeps the *staff* preview of a student's card honest, since a
 * staff caller can read unreleased rows and would otherwise be shown a total
 * the student cannot yet see.
 */
export function releasedOnly(entries: readonly MarkEntry[]): MarkEntry[] {
  return entries.filter((entry) => entry.publishedAt !== null);
}

/**
 * Pivots flat rows into one cell per component, in the order the components
 * are defined.
 *
 * This is the cost of storing one row per component rather than four columns
 * on one row (see 0025's header). It is contained here so no page has to know
 * about it, and it fills a gap for a component with no row at all — a subject
 * whose IA2 has not been touched must still render a cell, or the grid's
 * columns stop lining up with its header.
 */
export function pivotToComponents(
  components: readonly MarkComponent[],
  entries: readonly MarkEntry[],
): MarkEntry[] {
  const byCode = new Map(entries.map((entry) => [entry.componentCode, entry]));

  return components.map(
    (component) =>
      byCode.get(component.code) ?? {
        componentCode: component.code,
        marks: null,
        maxMarks: component.maxMarks,
        remark: null,
        publishedAt: null,
      },
  );
}

/**
 * Validates one typed cell before it reaches the database.
 *
 * The same ceiling is enforced by a check constraint, but a constraint
 * violation surfaces as a failed save for the whole class. Catching it here
 * lets the grid say which cell is wrong while keeping the other rows.
 */
export function validateMark(
  raw: string,
  maxMarks: number,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();

  // Blank clears the mark. This is the "not marked yet" state, and it must
  // stay reachable — a mark entered by mistake has to be removable.
  if (trimmed === "") return { ok: true, value: null };

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Enter a number, or leave it blank." };
  }
  if (value < 0) {
    return { ok: false, error: "Marks cannot be negative." };
  }
  if (value > maxMarks) {
    return { ok: false, error: `Maximum is ${maxMarks}.` };
  }

  // numeric(5,2) — anything finer is precision the mark sheet does not carry.
  return { ok: true, value: round2(value) };
}
