import { describe, expect, it } from "vitest";
import { RESOURCE_KIND_VALUES } from "@/config/resources";
import { parseBulkResources } from "../bulk";

/**
 * The paste-many box's parser.
 *
 * Bulk entry is where a curator loses track of what actually went in, so the
 * assertions that matter are the ones about what happens to a *bad* line: it
 * has to be reported with its line number, it must not take the good lines down
 * with it, and it must never be silently repaired. A blank cost column in
 * particular has to stay unknown — the whole three-state cost fix would be
 * undone by a parser that defaulted it to paid.
 */

const options = {
  // The real list, so a kind added to the config cannot silently stop being
  // accepted here.
  kinds: RESOURCE_KIND_VALUES,
  domains: [
    { id: 10, name: "Cybersecurity" },
    { id: 11, name: "Networking" },
  ],
  goals: [{ id: 1, name: "GATE / Higher studies in India" }],
};

const parse = (text: string) => parseBulkResources(text, options);

describe("parseBulkResources", () => {
  it("reads a full line into columns", () => {
    const { ok } = parse(
      "Crypto 101 | https://nptel.ac.in/x | course | NPTEL | free | Cybersecurity | GATE / Higher studies in India",
    );
    expect(ok).toHaveLength(1);
    expect(ok[0].values).toEqual({
      title: "Crypto 101",
      url: "https://nptel.ac.in/x",
      kind: "course",
      provider: "NPTEL",
      cost: "free",
      domainIds: [10],
      goalIds: [1],
    });
  });

  it("treats a blank cost column as not recorded, never as paid", () => {
    // The three-state cost bug, re-entering through a different door. A parser
    // that read a missing column as `false` would put "Paid" on every bulk row
    // whose curator simply did not know.
    const { ok } = parse("Thing | https://a.example/x | other | | | Cybersecurity");
    expect(ok[0].values?.cost).toBe("unknown");
  });

  it("omits trailing columns entirely without complaint", () => {
    const { ok, failed } = parse("Thing | https://a.example/x | other");
    expect(failed).toEqual([]);
    expect(ok[0].values).toMatchObject({
      provider: null,
      cost: "unknown",
      domainIds: [],
      goalIds: [],
    });
  });

  it("splits several tags on a semicolon", () => {
    const { ok } = parse(
      "Thing | https://a.example/x | course | | | Cybersecurity; Networking",
    );
    expect(ok[0].values?.domainIds).toEqual([10, 11]);
  });

  it("counts a repeated tag once", () => {
    const { ok } = parse(
      "Thing | https://a.example/x | course | | | Cybersecurity; Cybersecurity",
    );
    expect(ok[0].values?.domainIds).toEqual([10]);
  });

  it("matches tag names case- and space-insensitively", () => {
    const { ok } = parse("Thing | https://a.example/x | course | | |   cybersecurity  ");
    expect(ok[0].values?.domainIds).toEqual([10]);
  });
});

describe("parseBulkResources — rejections", () => {
  it("reports an unknown tag rather than creating one", () => {
    // Creating it would let a typo become a permanent option in every
    // student's profile.
    const { failed } = parse("Thing | https://a.example/x | course | | | Cyber Security");
    expect(failed).toHaveLength(1);
    expect(failed[0].errors.join(" ")).toContain("Cyber Security");
    expect(failed[0].values).toBeNull();
  });

  it("reports an unknown resource type", () => {
    const { failed } = parse("Thing | https://a.example/x | podcast");
    expect(failed[0].errors.join(" ")).toContain("podcast");
  });

  it("rejects anything that is not a full link", () => {
    const { failed } = parse("Thing | nptel.ac.in/x | course");
    expect(failed).toHaveLength(1);
    expect(failed[0].errors.join(" ")).toContain("http");
  });

  it("rejects a cost word it was not taught", () => {
    // Guessing that "cheap" means paid would put a price on a page nobody
    // priced — the same fabrication the three-state column exists to prevent.
    const { failed } = parse("Thing | https://a.example/x | course | | cheap");
    expect(failed[0].errors.join(" ")).toContain("cheap");
  });

  it("carries the line number of the paste, not of the parsed rows", () => {
    const { failed } = parse(
      ["# a comment", "", "Good | https://a.example/1 | course", "Bad | nope | course"].join(
        "\n",
      ),
    );
    expect(failed[0].line).toBe(4);
  });

  it("does not let one bad line discard the good ones", () => {
    const { ok, failed } = parse(
      [
        "One | https://a.example/1 | course",
        "Two | broken | course",
        "Three | https://a.example/3 | course",
      ].join("\n"),
    );
    expect(ok.map((r) => r.values?.title)).toEqual(["One", "Three"]);
    expect(failed).toHaveLength(1);
  });

  it("catches a link repeated within the same paste", () => {
    // Left to the database, the second insert would fail with a message about
    // a constraint rather than about the line the curator can see.
    const { ok, failed } = parse(
      [
        "One | https://a.example/1 | course",
        "Again | https://a.example/1 | course",
      ].join("\n"),
    );
    expect(ok).toHaveLength(1);
    expect(failed[0].errors.join(" ")).toContain("appears earlier");
  });

  it("keeps the offending text so the curator can find the line", () => {
    const { failed } = parse("Thing | nope | course");
    expect(failed[0].raw).toBe("Thing | nope | course");
  });
});

describe("parseBulkResources — what it ignores", () => {
  it("ignores blank lines and comments", () => {
    const { rows } = parse(
      ["", "# notes to self", "  ", "One | https://a.example/1 | course"].join("\n"),
    );
    expect(rows).toHaveLength(1);
  });

  it("ignores a header row pasted from a spreadsheet", () => {
    const { rows } = parse(
      ["title | url | kind | provider", "One | https://a.example/1 | course"].join("\n"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].values?.title).toBe("One");
  });

  it("returns nothing at all for empty input", () => {
    expect(parse("").rows).toEqual([]);
    expect(parse("\n\n  \n").rows).toEqual([]);
  });
});
