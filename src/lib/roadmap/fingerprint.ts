/**
 * Deciding whether a roadmap is still current (PRD 5.10).
 *
 * A roadmap regenerates when the profile it was built from changes. Detecting
 * that by timestamp would regenerate on every save — including a save that
 * changed nothing — so instead the inputs are reduced to a short, stable
 * string and compared.
 *
 * Pure and dependency-free, like the generator itself: this decides how often
 * a student's plan is rewritten under them, and that is worth being able to
 * test without a database.
 */

import type { RoadmapInput } from "./generate";

/**
 * A stable digest of everything the generator reads.
 *
 * Sorted, because the order ids come back from Postgres is not guaranteed and
 * an unsorted join would regenerate the plan on every page view. Rounded
 * marks, because a 78.4 that becomes 78.40 is not a change worth rewriting a
 * plan over.
 *
 * Deliberately not a hash. It is short enough to store as-is, and a plain
 * string means a stale roadmap can be diagnosed by looking at the row rather
 * than by re-running the hash to find out what it stood for.
 */
export function fingerprintInputs(input: RoadmapInput): string {
  const list = (values: string[]) => [...values].sort().join("|");
  const mark = (value: number | null) =>
    value === null ? "-" : String(Math.round(value));

  return [
    `d:${input.departmentName}`,
    `s:${input.semester ?? "-"}`,
    `g:${list(input.goals)}`,
    `dom:${list(input.domains)}`,
    `i:${list(input.interests)}`,
    `t:${mark(input.tenthPercentage)}`,
    `w:${mark(input.twelfthPercentage)}`,
    // Bucketed rather than exact: a plan should change when a student goes
    // from having no verified achievements to having some, not every time
    // one more is verified.
    `a:${input.verifiedAchievements === 0 ? "none" : "some"}`,
    `subj:${list(input.vtuSubjects ?? [])}`,
  ].join(";");
}

/** True when the stored plan no longer reflects the student's profile. */
export function isStale(
  storedFingerprint: string | null,
  input: RoadmapInput,
): boolean {
  // A roadmap written before fingerprinting existed has none. Treating that
  // as stale regenerates it once, which is the right outcome — an old plan of
  // unknown provenance is exactly what should be refreshed.
  if (storedFingerprint === null) return true;
  return storedFingerprint !== fingerprintInputs(input);
}
