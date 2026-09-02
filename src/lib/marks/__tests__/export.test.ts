import { describe, expect, it } from "vitest";
import { marksCsvResponse } from "../export";
import type { MarkComponent, MarkEntry } from "@/config/marks";
import type { MarksExportRow } from "@/lib/queries/marks";
import type { DirectoryRow } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";

const COMPONENTS: MarkComponent[] = [
  { code: "ia1", label: "1st IA", maxMarks: 20, sortOrder: 10, isActive: true },
  { code: "ia2", label: "2nd IA", maxMarks: 20, sortOrder: 20, isActive: true },
];

// Built the way a route builds it, rather than an empty cast: `describeFilters`
// keys off `!== null`, so a hand-made object with undefined fields would
// render "10th ≥ undefined%" and test a shape the app never produces.
const FILTERS = parseFilters({});

function student(over: Partial<DirectoryRow> = {}): DirectoryRow {
  return {
    id: "s1",
    fullName: "Aisha R",
    usn: "1HK24AI001",
    email: "a@hkbk.edu.in",
    phone: "9000000001",
    departmentCode: "AIML",
    city: "Bengaluru",
    state: "Karnataka",
    semester: 1,
    section: "A",
    quota: "cet",
    residenceType: "hostel",
    tenthPercentage: 90,
    twelfthPercentage: 88,
    entranceRank: 1200,
    completionPercent: 100,
    guardianName: null,
    guardianPhone: null,
    guardianVisible: false,
    ...over,
  };
}

function entry(over: Partial<MarkEntry> & { componentCode: string }): MarkEntry {
  return {
    marks: null,
    maxMarks: 20,
    remark: null,
    publishedAt: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function row(over: Partial<MarksExportRow> = {}): MarksExportRow {
  return {
    studentId: "s1",
    subjectCode: "BMATS101",
    subjectName: "Mathematics-I",
    semester: 1,
    byComponent: new Map(),
    scored: 0,
    outOf: 0,
    unreleased: [],
    ...over,
  };
}

async function bodyOf(response: Response): Promise<string> {
  return await response.text();
}

describe("marksCsvResponse", () => {
  it("writes a column per component, generated from the component list", async () => {
    const csv = await bodyOf(
      marksCsvResponse({
        rows: [row()],
        students: [student()],
        components: COMPONENTS,
        filters: FILTERS,
        generatedBy: "Someone",
        scopeNote: "Scope",
      }),
    );

    expect(csv).toContain("1st IA (out of 20)");
    expect(csv).toContain("2nd IA (out of 20)");
  });

  // The rule the whole feature is built around. Checked against the column
  // headers specifically: the word CIE *should* appear in the disclaimer,
  // which is the sentence saying this is not one.
  it("never labels a column as CIE", async () => {
    const csv = await bodyOf(
      marksCsvResponse({
        rows: [row()],
        students: [student()],
        components: COMPONENTS,
        filters: FILTERS,
        generatedBy: "Someone",
        scopeNote: "Scope",
      }),
    );

    const headerRow = csv
      .split("\r\n")
      .find((line) => line.startsWith("Full name,"))!;

    expect(headerRow).toContain("Sum of recorded components");
    expect(headerRow).not.toMatch(/\bCIE\b/);
  });

  it("carries the disclaimer in the provenance header", async () => {
    const csv = await bodyOf(
      marksCsvResponse({
        rows: [row()],
        students: [student()],
        components: COMPONENTS,
        filters: FILTERS,
        generatedBy: "Someone",
        scopeNote: "Scope",
      }),
    );
    expect(csv).toContain("not your official CIE");
  });

  // A zero in a spreadsheet is a decision somebody acts on.
  it("leaves an unmarked component blank rather than writing 0", async () => {
    const csv = await bodyOf(
      marksCsvResponse({
        rows: [
          row({
            byComponent: new Map([
              ["ia1", entry({ componentCode: "ia1", marks: 17 })],
            ]),
            scored: 17,
            outOf: 20,
          }),
        ],
        students: [student()],
        components: COMPONENTS,
        filters: FILTERS,
        generatedBy: "Someone",
        scopeNote: "Scope",
      }),
    );

    const dataLine = csv.split("\r\n").find((l) => l.includes("1HK24AI001"))!;
    // ...,BMATS101,Mathematics-I,17,,17,20,
    expect(dataLine).toContain(",17,,");
    expect(dataLine).not.toContain(",17,0,");
  });

  it("names unreleased components so a figure is not mistaken for a released one", async () => {
    const csv = await bodyOf(
      marksCsvResponse({
        rows: [
          row({
            byComponent: new Map([
              ["ia2", entry({ componentCode: "ia2", marks: 18, publishedAt: null })],
            ]),
            unreleased: ["2nd IA"],
          }),
        ],
        students: [student()],
        components: COMPONENTS,
        filters: FILTERS,
        generatedBy: "Someone",
        scopeNote: "Scope",
      }),
    );

    expect(csv).toContain("Unreleased components");
    expect(csv).toContain("2nd IA");
  });

  // The marks read and the directory read are separate queries; a student
  // filtered out of one must not appear unnamed in the other.
  it("drops a marks row whose student is outside the filtered set", async () => {
    const csv = await bodyOf(
      marksCsvResponse({
        rows: [row({ studentId: "not-in-scope" })],
        students: [student()],
        components: COMPONENTS,
        filters: FILTERS,
        generatedBy: "Someone",
        scopeNote: "Scope",
      }),
    );

    expect(csv).not.toContain("BMATS101");
    expect(csv).toContain("Rows,1");
  });

  it("serves as a no-store attachment, because it holds personal data", async () => {
    const response = marksCsvResponse({
      rows: [row()],
      students: [student()],
      components: COMPONENTS,
      filters: FILTERS,
      generatedBy: "Someone",
      scopeNote: "Scope",
      filenamePrefix: "aiml-marks",
    });

    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    expect(response.headers.get("Content-Disposition")).toContain("aiml-marks-");
    expect(response.headers.get("Content-Type")).toContain("text/csv");
  });

  it("escapes a cell that would otherwise be read as a formula", async () => {
    const csv = await bodyOf(
      marksCsvResponse({
        rows: [row({ subjectName: "=cmd|calc" })],
        students: [student()],
        components: COMPONENTS,
        filters: FILTERS,
        generatedBy: "Someone",
        scopeNote: "Scope",
      }),
    );

    expect(csv).toContain("'=cmd|calc");
  });
});
