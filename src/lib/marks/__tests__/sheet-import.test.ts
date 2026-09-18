import { describe, expect, it } from "vitest";
import {
  buildPreview,
  csvExportUrl,
  isImportable,
  mapColumns,
  parseCsv,
  parseSheetUrl,
  type ComponentDef,
  type RosterStudent,
} from "../sheet-import";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-ab";

const COMPONENTS: ComponentDef[] = [
  { code: "ia1", label: "1st IA", maxMarks: 20 },
  { code: "ia2", label: "2nd IA", maxMarks: 20 },
  { code: "assignment", label: "Assignment", maxMarks: 10 },
];

const ROSTER: RosterStudent[] = [
  { id: "s1", usn: "1HK25AI001", fullName: "Asha" },
  { id: "s2", usn: "1HK25AI002", fullName: "Bala" },
  { id: "s3", usn: "1HK25AI003", fullName: "Chetan" },
];

function preview(csv: string, current: Array<[string, number]> = []) {
  const rows = parseCsv(csv);
  const mapped = mapColumns(rows[0], COMPONENTS);
  if (!mapped.ok) throw new Error(mapped.error);
  return buildPreview(rows, mapped.map, ROSTER, new Map(current));
}

describe("parseSheetUrl", () => {
  it("reads the id and the tab from an address-bar link", () => {
    expect(
      parseSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=123456`),
    ).toEqual({ ok: true, ref: { spreadsheetId: ID, gid: "123456" } });
  });

  it("reads a tab given in the query string", () => {
    const result = parseSheetUrl(
      `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing&gid=42`,
    );
    expect(result.ok && result.ref.gid).toBe("42");
  });

  it("defaults to the first tab when the link names none", () => {
    const result = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`);
    expect(result.ok && result.ref.gid).toBe("0");
  });

  it("refuses anything that is not a Google Sheet", () => {
    expect(parseSheetUrl("https://example.com/spreadsheets/d/" + ID).ok).toBe(false);
    expect(parseSheetUrl("https://docs.google.com/document/d/" + ID).ok).toBe(false);
    expect(parseSheetUrl("not a link").ok).toBe(false);
    expect(parseSheetUrl("").ok).toBe(false);
  });

  it("does not let a look-alike host through", () => {
    // The fetched URL is always rebuilt from the id, but the host check is
    // what refuses these before anything is fetched at all.
    expect(parseSheetUrl(`https://docs.google.com.evil.test/spreadsheets/d/${ID}`).ok).toBe(false);
    expect(parseSheetUrl(`https://evil.test/?u=https://docs.google.com/spreadsheets/d/${ID}`).ok).toBe(false);
  });

  it("builds the export URL from the id alone, never from the input", () => {
    expect(csvExportUrl({ spreadsheetId: ID, gid: "7" })).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=7`,
    );
  });
});

describe("parseCsv", () => {
  it("handles quotes, embedded commas, doubled quotes, CRLF and a BOM", () => {
    const text = '﻿USN,Name,Note\r\n1HK25AI001,"Rao, Asha","said ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([
      ["USN", "Name", "Note"],
      ["1HK25AI001", "Rao, Asha", 'said "hi"'],
    ]);
  });

  it("keeps a line break inside a quoted cell", () => {
    expect(parseCsv('a,b\n"x\ny",z')).toEqual([["a", "b"], ["x\ny", "z"]]);
  });

  it("drops wholly empty rows Google pads the export with", () => {
    expect(parseCsv("USN,1st IA\n,\n1HK25AI001,17\n,,\n")).toEqual([
      ["USN", "1st IA"],
      ["1HK25AI001", "17"],
    ]);
  });
});

describe("mapColumns", () => {
  it("recognises the common ways a college heads IA columns", () => {
    for (const header of ["1st IA", "IA1", "IA 1", "IA-1", "First IA", "1st IA (20)", "CIE 1"]) {
      const result = mapColumns(["USN", header], COMPONENTS);
      expect(result.ok && result.map.components[0].code, header).toBe("ia1");
    }
  });

  it("reports columns it did not use, rather than dropping them silently", () => {
    const result = mapColumns(["Sl No", "USN", "Name", "1st IA", "Remarks"], COMPONENTS);
    expect(result.ok && result.map.ignored).toEqual(["Sl No", "Name", "Remarks"]);
  });

  it("requires a USN column", () => {
    const result = mapColumns(["Name", "1st IA"], COMPONENTS);
    expect(result.ok).toBe(false);
  });

  it("requires at least one marks column", () => {
    const result = mapColumns(["USN", "Name"], COMPONENTS);
    expect(result.ok).toBe(false);
  });

  it("does not read the same component twice", () => {
    const result = mapColumns(["USN", "1st IA", "IA1"], COMPONENTS);
    expect(result.ok && result.map.components).toHaveLength(1);
    expect(result.ok && result.map.ignored).toEqual(["IA1"]);
  });
});

describe("buildPreview", () => {
  it("turns numbers into changes against what the portal already holds", () => {
    const p = preview("USN,1st IA,2nd IA\n1HK25AI001,17,19", [["s1:ia1", 12]]);
    expect(p.changes).toEqual([
      expect.objectContaining({ usn: "1HK25AI001", componentCode: "ia1", from: 12, to: 17 }),
      expect.objectContaining({ usn: "1HK25AI001", componentCode: "ia2", from: null, to: 19 }),
    ]);
    expect(isImportable(p)).toBe(true);
  });

  it("leaves a mark alone when its cell is blank", () => {
    // An empty 2nd IA column usually means IA2 has not happened yet. Clearing
    // on blank would delete real marks every time someone imported early.
    const p = preview("USN,1st IA,2nd IA\n1HK25AI001,17,", [["s1:ia2", 15]]);
    expect(p.changes.map((c) => c.componentCode)).toEqual(["ia1"]);
  });

  it("treats AB as no mark, and shows it when that removes one", () => {
    const p = preview("USN,1st IA\n1HK25AI001,AB\n1HK25AI002,absent", [["s1:ia1", 14]]);
    // s1 had 14, so AB removes it — visible in the preview.
    expect(p.changes).toEqual([
      expect.objectContaining({ usn: "1HK25AI001", from: 14, to: null }),
    ]);
    // s2 had nothing and is absent: nothing to change.
    expect(p.unchanged).toBe(1);
  });

  it("counts values that already match as unchanged", () => {
    const p = preview("USN,1st IA\n1HK25AI001,17", [["s1:ia1", 17]]);
    expect(p.changes).toEqual([]);
    expect(p.unchanged).toBe(1);
    expect(isImportable(p)).toBe(false);
  });

  it("blocks the import on a mark above the maximum", () => {
    const p = preview("USN,1st IA\n1HK25AI001,25\n1HK25AI002,18");
    expect(p.errors).toEqual([
      expect.objectContaining({ row: 2, usn: "1HK25AI001", value: "25" }),
    ]);
    expect(isImportable(p)).toBe(false);
  });

  it("blocks the import on text that is not a mark", () => {
    const p = preview("USN,1st IA\n1HK25AI001,seventeen");
    expect(p.errors).toHaveLength(1);
    expect(isImportable(p)).toBe(false);
  });

  it("skips USNs outside this class without treating them as errors", () => {
    // A sheet often covers every section; the class shown may be one of them.
    const p = preview("USN,1st IA\n1HK25AI001,17\n1HK25CS099,12");
    expect(p.notInClass).toEqual(["1HK25CS099"]);
    expect(p.errors).toEqual([]);
    expect(isImportable(p)).toBe(true);
  });

  it("matches USNs regardless of case and stray spaces", () => {
    const p = preview("USN,1st IA\n 1hk25ai001 ,17");
    expect(p.changes[0]?.studentId).toBe("s1");
  });

  it("blocks the import when a USN appears twice", () => {
    const p = preview("USN,1st IA\n1HK25AI001,17\n1HK25AI001,12");
    expect(p.duplicates).toEqual(["1HK25AI001"]);
    expect(p.changes).toEqual([]);
    expect(isImportable(p)).toBe(false);
  });

  it("counts class members the sheet never mentions, and leaves them be", () => {
    const p = preview("USN,1st IA\n1HK25AI001,17");
    expect(p.missingFromSheet).toBe(2);
  });

  it("reports rows by the number Google shows beside them", () => {
    const p = preview("USN,1st IA\n1HK25AI001,17\n1HK25AI002,99");
    expect(p.errors[0].row).toBe(3);
  });
});
