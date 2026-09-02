/**
 * Parsing for the admin paste-many box.
 *
 * Curating a catalogue one form at a time is the reason `public.resources` sat
 * empty: a domain needs a dozen entries before its shelf is worth opening, and
 * a dozen round trips through a twelve-field form is an afternoon. This parses
 * a pasted block — one resource per line, columns separated by `|` — into rows
 * the existing `resourceSchema` can validate.
 *
 * Pure, and free of `server-only`, so the parsing rules can be tested without a
 * database. The action layer does the inserting; this only reads text.
 *
 * Two rules shape everything below, and both are about not quietly inventing
 * data on somebody's behalf:
 *
 *   - **A line either parses or is reported.** There is no partial import of a
 *     line and no silent skip. A curator who pastes forty rows and is told
 *     "38 added" without knowing which two failed has lost two resources and
 *     does not know it.
 *   - **A tag name that does not match is an error, not a new tag.** Fuzzy
 *     matching "Cyber Security" onto "Cybersecurity" would work until the day
 *     it matched the wrong thing, and creating the tag would let a typo become
 *     a permanent option in every student's profile.
 *
 * Cost defaults to `unknown` when the column is blank, which is the only
 * defensible default: a blank column means the curator did not say, and
 * `unknown` is how the catalogue records not having been told.
 */

import type { CostChoice, ResourceKind } from "@/config/resources";

/** The columns, in order. Trailing ones may be omitted. */
export const BULK_COLUMNS = [
  "title",
  "url",
  "kind",
  "provider",
  "cost",
  "domains",
  "goals",
] as const;

export const BULK_TEMPLATE =
  "title | url | kind | provider | cost | domains | goals";

export const BULK_EXAMPLE = [
  "Cryptography and Network Security | https://nptel.ac.in/courses/106105031 | course | NPTEL | free | Cybersecurity",
  "OWASP Top Ten | https://owasp.org/www-project-top-ten/ | other | OWASP | | Cybersecurity",
].join("\n");

export type BulkValues = {
  title: string;
  url: string;
  /**
   * Narrowed to a real `ResourceKind` by matching against the list, rather
   * than carried as a `string` and asserted at the insert. The insert is the
   * wrong place to discover a curator typed "podcast".
   */
  kind: ResourceKind;
  provider: string | null;
  cost: CostChoice;
  domainIds: number[];
  goalIds: number[];
};

export type BulkRow = {
  /** 1-based line number in the pasted text, for pointing at the bad line. */
  line: number;
  raw: string;
  values: BulkValues | null;
  errors: string[];
};

export type BulkParseResult = {
  rows: BulkRow[];
  ok: BulkRow[];
  failed: BulkRow[];
};

type Option = { id: number; name: string };

/**
 * Exact name match, case- and space-insensitive only.
 *
 * Nothing fuzzier: the whole point of matching against the existing option list
 * is that a name which is not on it is a mistake the curator should see, not a
 * near-miss the parser should resolve for them.
 */
function nameIndex(options: readonly Option[]): Map<string, number> {
  return new Map(
    options.map((o) => [o.name.trim().toLowerCase(), o.id] as const),
  );
}

function resolveTags(
  cell: string,
  index: Map<string, number>,
  what: string,
  errors: string[],
): number[] {
  if (cell === "") return [];

  const ids: number[] = [];
  for (const name of cell.split(";").map((n) => n.trim()).filter(Boolean)) {
    const id = index.get(name.toLowerCase());
    if (id === undefined) {
      errors.push(`No ${what} named "${name}".`);
      continue;
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * The only words accepted in the cost column.
 *
 * Typed as possibly-undefined on purpose: an unrecognised word has to fall out
 * as a rejection rather than through a default. Guessing that "cheap" means
 * paid would put a price on a page nobody priced.
 */
const COST_WORDS: Record<string, CostChoice | undefined> = {
  free: "free",
  paid: "paid",
  "": "unknown",
  unknown: "unknown",
  "-": "unknown",
};

/**
 * One row per non-blank line, each either parsed or carrying its reasons.
 *
 * Blank lines and lines starting `#` are dropped — a pasted block from a
 * spreadsheet usually has a header row, and making the curator delete it before
 * pasting is friction for nothing.
 *
 * Duplicate URLs *within the paste* are reported here rather than left to the
 * database, because the unique constraint would fail the second insert with a
 * message about a constraint rather than about the line the curator can see.
 */
export function parseBulkResources(
  text: string,
  options: {
    kinds: readonly ResourceKind[];
    domains: readonly Option[];
    goals: readonly Option[];
  },
): BulkParseResult {
  const domainIndex = nameIndex(options.domains);
  const goalIndex = nameIndex(options.goals);

  const seenUrls = new Set<string>();
  const rows: BulkRow[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;

    // A header row pasted from a spreadsheet, recognised so it can be ignored
    // rather than reported as a resource called "title".
    if (/^title\s*\|/i.test(trimmed)) return;

    const cells = trimmed.split("|").map((c) => c.trim());
    const errors: string[] = [];
    const cell = (n: number) => cells[n] ?? "";

    const title = cell(0);
    const url = cell(1);
    // Looked up rather than cast: `find` returns the real `ResourceKind`, so
    // an unrecognised word cannot reach the insert wearing the right type.
    const wanted = cell(2).toLowerCase();
    const kind = options.kinds.find((k) => k === wanted);
    const provider = cell(3);
    const costWord = cell(4).toLowerCase();

    if (title.length < 3) errors.push("Give the resource a title.");
    if (!/^https?:\/\/\S+$/i.test(url)) {
      errors.push("Enter a full link, starting http:// or https://");
    } else if (seenUrls.has(url.toLowerCase())) {
      errors.push("This link appears earlier in the paste.");
    } else {
      seenUrls.add(url.toLowerCase());
    }

    if (!kind) {
      errors.push(
        wanted === ""
          ? "Say what kind of resource this is."
          : `"${cell(2)}" is not a resource type.`,
      );
    }

    const cost = COST_WORDS[costWord];
    if (cost === undefined) {
      errors.push(`Cost must be free, paid, or blank — not "${cell(4)}".`);
    }

    const domainIds = resolveTags(cell(5), domainIndex, "domain", errors);
    const goalIds = resolveTags(cell(6), goalIndex, "goal", errors);

    rows.push({
      line,
      raw: trimmed,
      errors,
      // `kind` and `cost` are tested again here rather than relied on through
      // `errors.length`, so the narrowing is something the compiler can see
      // rather than something the reader has to trust.
      values:
        errors.length === 0 && kind && cost
          ? {
              title,
              url,
              kind,
              provider: provider === "" ? null : provider,
              cost,
              domainIds,
              goalIds,
            }
          : null,
    });
  });

  return {
    rows,
    ok: rows.filter((r) => r.values !== null),
    failed: rows.filter((r) => r.values === null),
  };
}
