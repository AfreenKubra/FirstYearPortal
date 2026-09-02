/**
 * Catalogue filters for the roadmap panels (PRD 5.9).
 *
 * Pure and generic, living beside `recommend.ts` rather than inside
 * `queries/resources.ts`, for the same reason `recommend.ts` does: that file
 * imports `server-only`, and the selection rules below are exactly the part
 * worth testing without a database. The query module re-exports these so
 * callers still have one place to look.
 *
 * The generics are load-bearing, not decoration. Each function narrows a list
 * without changing what is in it, so `filterResourcesForDomains(resources, …)`
 * returns `Resource[]` and a test can hand in a three-field literal. Neither
 * function reads a field it does not declare.
 *
 * These are filters, deliberately not rankers. `recommendResources` scores,
 * weights and caps, which is right for a recommendations page and wrong here:
 * a student who asked to see the courses for their domain wants all of them,
 * and quietly returning the best six would hide the rest with no way to tell
 * they existed.
 */

/** Today as `YYYY-MM-DD`, to compare against the `date` columns from 0023. */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type DomainTagged = { kind: string; domainIds: number[] };

/**
 * Every entry tagged with at least one of `domainIds`.
 *
 * A union across the student's domains, not an intersection: material tagged
 * to Cybersecurity is relevant to someone who picked Cybersecurity and
 * Networking, and requiring both would empty the shelf for anyone who picked
 * more than one thing.
 *
 * Untagged entries are excluded and there is no fallback to "show everything".
 * An untagged resource is not evidence of anything, and rolling it in would
 * make the shelf grow every time an unrelated entry was added — the count
 * under a heading that says "for your domains" has to mean that.
 *
 * Input order is preserved, so the caller's sort (verified first, then title)
 * survives. Order here is never allowed to imply free-over-paid endorsement.
 */
export function filterResourcesForDomains<T extends DomainTagged>(
  resources: T[],
  domainIds: number[],
  kinds?: readonly string[],
): T[] {
  if (domainIds.length === 0) return [];

  const wanted = new Set(domainIds);
  const kindFilter = kinds ? new Set<string>(kinds) : null;

  return resources.filter((resource) => {
    if (kindFilter && !kindFilter.has(resource.kind)) return false;
    return resource.domainIds.some((id) => wanted.has(id));
  });
}

type ExamTagged = {
  kind: string;
  goalIds: number[];
  occursOn: string | null;
  title: string;
};

/**
 * Dated exams for the goals a student picked, soonest first.
 *
 * Two judgements are encoded here, both about honesty rather than relevance:
 *
 *   - An exam whose date has passed is dropped. Last year's date is worse than
 *     no date, because it reads as current until someone checks it.
 *   - An exam with no recorded date is kept, and sorted last. The panel can
 *     link to it honestly while saying the date is not recorded, and dropping
 *     it would hide a resource an administrator deliberately added.
 *
 * Comparison is lexicographic on `YYYY-MM-DD`, which is chronological for that
 * format and avoids parsing a bare date string into a `Date` — a constructor
 * that reads it as UTC midnight and, west of Greenwich, shifts it a day.
 */
export function filterExamResourcesForGoals<T extends ExamTagged>(
  resources: T[],
  goalIds: number[],
  today: string = todayISO(),
): T[] {
  if (goalIds.length === 0) return [];

  const wanted = new Set(goalIds);

  return resources
    .filter((r) => r.kind === "exam")
    .filter((r) => r.goalIds.some((id) => wanted.has(id)))
    .filter((r) => r.occursOn === null || r.occursOn >= today)
    .sort((a, b) => {
      // Undated last — a date is the thing this panel exists to show.
      if (a.occursOn === null && b.occursOn === null) {
        return a.title.localeCompare(b.title);
      }
      if (a.occursOn === null) return 1;
      if (b.occursOn === null) return -1;
      return a.occursOn.localeCompare(b.occursOn);
    });
}
