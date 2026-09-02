/**
 * Which tags students have chosen, and whether the catalogue answers them.
 *
 * The roadmap panels added alongside this file render from tags: a student who
 * picks Cybersecurity gets a shelf of Cybersecurity courses, and a student who
 * picks GATE gets a dated exam track. When nothing in the catalogue carries the
 * tag, the panel is honest — it says the shelf is empty — but that honesty is
 * invisible to the person who could fix it. An administrator opening the
 * resources page sees a healthy-looking list and no indication that fourteen
 * students are looking at an empty panel.
 *
 * This module turns that silence into a number. It counts, per tag, how many
 * students chose it and how many catalogue entries carry it, so the admin page
 * can order the work by how many people are affected rather than by whoever
 * complained most recently.
 *
 * Pure and free of `server-only`, like `filters.ts` beside it: the counting and
 * the ordering are the parts worth testing, and they should not need a
 * database to exercise.
 *
 * It counts. It does not recommend, score, or predict. A gap here means
 * "nobody has added one of these yet" — never "one of these ought to exist",
 * which is a judgement only the curator can make.
 */

export type TagKind = "goal" | "domain";

export type TagCoverage = {
  kind: TagKind;
  id: number;
  name: string;
  /** Students who chose this tag. */
  students: number;
  /** Catalogue entries carrying this tag. */
  resources: number;
};

type Option = { id: number; name: string };

function tally(ids: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * One row per option, counted against the two tag lists.
 *
 * Both lists are flat: one entry per (student, tag) or (resource, tag) pair,
 * which is exactly the shape the join tables return. A tag nobody has chosen
 * and nothing is tagged with still gets a row — a zero is a fact, and dropping
 * it would make the table silently shorter than the option list it describes.
 *
 * Ordering puts the work first: gaps that affect somebody, most-affected
 * first, then everything else by student count. Ties break on name so the
 * table does not reshuffle between page loads.
 */
export function tagCoverage(
  options: readonly Option[],
  kind: TagKind,
  studentTagIds: readonly number[],
  resourceTagIds: readonly number[],
): TagCoverage[] {
  const byStudent = tally(studentTagIds);
  const byResource = tally(resourceTagIds);

  return options
    .map((option) => ({
      kind,
      id: option.id,
      name: option.name,
      students: byStudent.get(option.id) ?? 0,
      resources: byResource.get(option.id) ?? 0,
    }))
    .sort((a, b) => {
      const aGap = isGap(a) ? 0 : 1;
      const bGap = isGap(b) ? 0 : 1;
      if (aGap !== bGap) return aGap - bGap;
      if (a.students !== b.students) return b.students - a.students;
      return a.name.localeCompare(b.name);
    });
}

/**
 * A tag some student is waiting on and nothing in the catalogue answers.
 *
 * Deliberately not "few resources" — there is no defensible threshold for how
 * many courses a domain ought to have, and inventing one would turn a count
 * into an opinion. Zero-with-somebody-waiting is the only unambiguous case.
 */
export function isGap(row: TagCoverage): boolean {
  return row.resources === 0 && row.students > 0;
}

/** The rows worth acting on, already ordered by how many students are affected. */
export function gaps(rows: readonly TagCoverage[]): TagCoverage[] {
  return rows.filter(isGap);
}

/**
 * The sentence shown beside a gap.
 *
 * Says what is true and stops: a tag, a count, and the consequence. It does
 * not suggest what to add, because the module has no basis for that.
 */
export function describeGap(row: TagCoverage): string {
  const students =
    row.students === 1 ? "1 student sees" : `${row.students} students see`;
  const panel = row.kind === "domain" ? "an empty course shelf" : "no exam track";
  return `Nothing is tagged ${row.name} — ${students} ${panel}.`;
}
