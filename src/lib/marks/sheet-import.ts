/**
 * Importing internal marks from a Google Sheet.
 *
 * Pure: no fetch, no database. The server action fetches the CSV and loads
 * the class; everything that decides what a mark becomes lives here, where it
 * can be tested — the same split `compute.ts` makes for the marks grid.
 *
 * The contract, chosen with the institution:
 *
 *   - One tab per subject, columns `USN | 1st IA | 2nd IA` (any active mark
 *     component, matched by its label or code).
 *   - The sheet is shared as "Anyone with the link can view", and read through
 *     Google's CSV export — no API key, no OAuth.
 *   - Import is previewed before anything is written, and the preview is what
 *     gets written: a fingerprint of the sheet ties the two together.
 *
 * Three cell rules differ from the marks grid, deliberately:
 *
 *   - A blank cell leaves the portal's mark alone. In the grid, blank clears a
 *     mark; in a sheet, an empty "2nd IA" column almost always means IA2 has
 *     not happened yet, and clearing on blank would delete real marks every
 *     time a teacher imported early.
 *   - "AB" (or "Absent", "A", "-") means no mark. The schema records "not
 *     marked" as the absence of a row, so this removes an existing mark — and
 *     the preview shows that removal before it happens.
 *   - Anything else that is not a number in range is an error, and one error
 *     refuses the whole import, as `saveMarks` refuses a half-valid grid.
 */

import { validateMark } from "./compute";

// --- The link ---------------------------------------------------------------

export type SheetRef = { spreadsheetId: string; gid: string };

const SHEET_PATH = /^\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})(?:\/|$)/;

/**
 * Pulls the spreadsheet id and tab id out of whatever link was pasted.
 *
 * Only these two values are kept. The URL that is later fetched is built from
 * them (`csvExportUrl`), never taken from the input — so a pasted link cannot
 * point the server at any host other than Google's own export endpoint.
 */
export function parseSheetUrl(
  input: string,
): { ok: true; ref: SheetRef } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Paste the link to the sheet's tab." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "That is not a link. Copy it from the browser's address bar." };
  }

  if (url.hostname !== "docs.google.com") {
    return { ok: false, error: "Only Google Sheets links (docs.google.com) can be imported." };
  }

  const match = url.pathname.match(SHEET_PATH);
  if (!match) {
    return { ok: false, error: "That Google link is not a spreadsheet." };
  }

  // The tab lives in the hash (`#gid=123`) when copied from the address bar,
  // or the query (`?gid=123`) in some shared links. Without one, Google
  // exports the first tab.
  const gidFrom = (text: string) => text.match(/(?:^|[?&#])gid=(\d+)/)?.[1];
  const gid = gidFrom(url.hash) ?? gidFrom(url.search) ?? "0";

  return { ok: true, ref: { spreadsheetId: match[1], gid } };
}

export function csvExportUrl(ref: SheetRef): string {
  return `https://docs.google.com/spreadsheets/d/${ref.spreadsheetId}/export?format=csv&gid=${ref.gid}`;
}

// --- CSV --------------------------------------------------------------------

/**
 * RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside
 * quotes, CRLF, and a byte-order mark. Google's export uses all of these as
 * soon as a cell holds a comma or a line break.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Wholly empty rows carry nothing; Google pads exports with them.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// --- Columns ----------------------------------------------------------------

export type ComponentDef = { code: string; label: string; maxMarks: number };

export type ColumnMap = {
  usnIndex: number;
  components: Array<{ index: number; code: string; label: string; maxMarks: number }>;
  /** Both attendance columns, or neither — one without the other is an error. */
  attendance: { heldIndex: number; attendedIndex: number } | null;
  /** Headers read from the sheet that matched nothing, shown so none vanish unnoticed. */
  ignored: string[];
};

/** "1st IA (20)" → "1stia". A trailing "(max)" is common and carries nothing here. */
function normalise(header: string): string {
  return header
    .replace(/\(.*?\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const USN_HEADERS = new Set(["usn", "usnno", "usnnumber", "regno", "registerno", "registrationno"]);

// "Total" alone is deliberately absent: it is at least as likely to head a
// marks total, and reading marks as classes held would be a silent disaster.
const HELD_HEADERS = new Set([
  "classesheld", "held", "classesconducted", "conducted", "totalclasses", "totalheld", "hoursheld",
]);
const ATTENDED_HEADERS = new Set([
  "classesattended", "attended", "present", "classespresent", "attendedclasses", "hoursattended",
]);

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th"];
const WORD = ["", "first", "second", "third", "fourth", "fifth"];

/** Every header spelling that should mean this component. */
function spellings(component: ComponentDef): Set<string> {
  const names = new Set([normalise(component.code), normalise(component.label)]);
  // IA components get the ways a college actually writes them.
  const ia = component.code.match(/^ia(\d)$/);
  if (ia) {
    const n = Number(ia[1]);
    for (const form of [`ia${n}`, `${ORDINAL[n]}ia`, `${WORD[n]}ia`, `cie${n}`, `test${n}`]) {
      names.add(form);
    }
  }
  return names;
}

export function mapColumns(
  header: readonly string[],
  components: readonly ComponentDef[],
): { ok: true; map: ColumnMap } | { ok: false; error: string } {
  let usnIndex = -1;
  let heldIndex = -1;
  let attendedIndex = -1;
  const matched: ColumnMap["components"] = [];
  const ignored: string[] = [];
  const claimed = new Set<string>();

  header.forEach((raw, index) => {
    const key = normalise(raw);
    if (!key) return;

    if (usnIndex === -1 && USN_HEADERS.has(key)) {
      usnIndex = index;
      return;
    }
    if (heldIndex === -1 && HELD_HEADERS.has(key)) {
      heldIndex = index;
      return;
    }
    if (attendedIndex === -1 && ATTENDED_HEADERS.has(key)) {
      attendedIndex = index;
      return;
    }

    const component = components.find((c) => spellings(c).has(key));
    if (component && !claimed.has(component.code)) {
      claimed.add(component.code);
      matched.push({ index, ...component });
      return;
    }

    ignored.push(raw.trim());
  });

  if (usnIndex === -1) {
    return { ok: false, error: 'The first row needs a column headed "USN".' };
  }

  // Half an attendance pair cannot become a percentage, and guessing the
  // other half would put invented figures in front of a student.
  if ((heldIndex === -1) !== (attendedIndex === -1)) {
    return {
      ok: false,
      error:
        heldIndex === -1
          ? 'Found "Classes attended" but no "Classes held" column. Add both, or neither.'
          : 'Found "Classes held" but no "Classes attended" column. Add both, or neither.',
    };
  }
  const attendance = heldIndex === -1 ? null : { heldIndex, attendedIndex };

  if (matched.length === 0 && !attendance) {
    const expected = components.map((c) => `"${c.label}"`).join(", ");
    return {
      ok: false,
      error: `No marks or attendance column recognised. Head the columns with one of: ${expected}, or "Classes held" and "Classes attended".`,
    };
  }

  return { ok: true, map: { usnIndex, components: matched, attendance, ignored } };
}

// --- The preview ------------------------------------------------------------

export type RosterStudent = { id: string; usn: string; fullName: string };

/** The portal's current marks, keyed `${studentId}:${componentCode}`. */
export type CurrentMarks = ReadonlyMap<string, number>;

export type Change = {
  studentId: string;
  usn: string;
  fullName: string;
  componentCode: string;
  componentLabel: string;
  maxMarks: number;
  /** null: not marked in the portal. */
  from: number | null;
  /** null: the sheet says absent, so the mark is removed. */
  to: number | null;
};

export type CellError = {
  /** 1-based, counting the header, so it matches the row number Google shows. */
  row: number;
  usn: string;
  componentLabel: string;
  value: string;
  message: string;
};

export type AttendanceFigures = { held: number; attended: number };

/** The portal's current attendance, keyed by student id. */
export type CurrentAttendance = ReadonlyMap<string, AttendanceFigures>;

export type AttendanceChange = {
  studentId: string;
  usn: string;
  fullName: string;
  /** null: no attendance recorded in the portal yet. */
  from: AttendanceFigures | null;
  to: AttendanceFigures;
};

export type ImportPreview = {
  changes: Change[];
  attendanceChanges: AttendanceChange[];
  /** Cells whose value already matches the portal. */
  unchanged: number;
  errors: CellError[];
  /** USNs in the sheet that are not in this class — skipped, not errors. */
  notInClass: string[];
  /** USNs that appear on more than one row — ambiguous, so an error. */
  duplicates: string[];
  /** Students in the class the sheet does not mention — left exactly as they are. */
  missingFromSheet: number;
  ignoredColumns: string[];
  readColumns: string[];
};

const ABSENT = new Set(["ab", "absent", "a", "-", "na", "n/a"]);

const cleanUsn = (usn: string) => usn.replace(/\s+/g, "").toUpperCase();

const MAX_CLASSES = 500;

/**
 * One student's attendance pair, or a reason it cannot be read.
 *
 * Both blank: nothing to say yet, leave the portal alone. Held of zero: no
 * class has run, so there is no percentage — also left alone rather than
 * stored as 0 of 0. Anything else must be two whole numbers with attended
 * no more than held.
 */
function readAttendance(
  heldRaw: string,
  attendedRaw: string,
): { kind: "skip" } | { kind: "ok"; value: AttendanceFigures } | { kind: "error"; message: string } {
  const held = heldRaw.trim();
  const attended = attendedRaw.trim();

  if (held === "" && attended === "") return { kind: "skip" };
  if (held === "" || attended === "") {
    return { kind: "error", message: "Give both classes held and classes attended, or leave both blank." };
  }

  const h = Number(held);
  const a = Number(attended);
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
    return { kind: "error", message: "Classes held and attended must be whole numbers." };
  }
  if (h > MAX_CLASSES) {
    return { kind: "error", message: `More than ${MAX_CLASSES} classes held is not a semester.` };
  }
  if (a > h) {
    return { kind: "error", message: `Attended (${a}) is more than held (${h}).` };
  }
  if (h === 0) return { kind: "skip" };

  return { kind: "ok", value: { held: h, attended: a } };
}

export function buildPreview(
  rows: readonly string[][],
  map: ColumnMap,
  roster: readonly RosterStudent[],
  current: CurrentMarks,
  currentAttendance: CurrentAttendance = new Map(),
): ImportPreview {
  const byUsn = new Map(roster.map((s) => [cleanUsn(s.usn), s]));
  const seen = new Map<string, number>();
  const changes: Change[] = [];
  const attendanceChanges: AttendanceChange[] = [];
  const errors: CellError[] = [];
  const notInClass: string[] = [];
  let unchanged = 0;

  // Row 0 is the header.
  rows.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const usn = cleanUsn(cells[map.usnIndex] ?? "");
    if (!usn) return;

    seen.set(usn, (seen.get(usn) ?? 0) + 1);

    const student = byUsn.get(usn);
    if (!student) {
      notInClass.push(usn);
      return;
    }

    for (const column of map.components) {
      const raw = (cells[column.index] ?? "").trim();

      // Blank: leave the portal's mark exactly as it is.
      if (raw === "") continue;

      let to: number | null;
      if (ABSENT.has(raw.toLowerCase())) {
        to = null;
      } else {
        const result = validateMark(raw, column.maxMarks);
        if (!result.ok) {
          errors.push({
            row: rowNumber,
            usn,
            componentLabel: column.label,
            value: raw,
            message: result.error,
          });
          continue;
        }
        to = result.value;
      }

      const key = `${student.id}:${column.code}`;
      const from = current.has(key) ? (current.get(key) as number) : null;

      if (from === to) {
        unchanged += 1;
        continue;
      }

      changes.push({
        studentId: student.id,
        usn,
        fullName: student.fullName,
        componentCode: column.code,
        componentLabel: column.label,
        maxMarks: column.maxMarks,
        from,
        to,
      });
    }

    if (map.attendance) {
      const read = readAttendance(
        cells[map.attendance.heldIndex] ?? "",
        cells[map.attendance.attendedIndex] ?? "",
      );
      if (read.kind === "error") {
        errors.push({
          row: rowNumber,
          usn,
          componentLabel: "Attendance",
          value: `${(cells[map.attendance.attendedIndex] ?? "").trim() || "—"} of ${(cells[map.attendance.heldIndex] ?? "").trim() || "—"}`,
          message: read.message,
        });
      } else if (read.kind === "ok") {
        const before = currentAttendance.get(student.id) ?? null;
        if (before && before.held === read.value.held && before.attended === read.value.attended) {
          unchanged += 1;
        } else {
          attendanceChanges.push({
            studentId: student.id,
            usn,
            fullName: student.fullName,
            from: before,
            to: read.value,
          });
        }
      }
    }
  });

  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([u]) => u);

  // A duplicated USN makes every change for that student ambiguous: which row
  // is right? Drop them from the changes; the duplicate itself blocks import.
  const dup = new Set(duplicates);
  const safeChanges = changes.filter((c) => !dup.has(c.usn));

  return {
    changes: safeChanges,
    attendanceChanges: attendanceChanges.filter((c) => !dup.has(c.usn)),
    unchanged,
    errors,
    notInClass: [...new Set(notInClass)],
    duplicates,
    missingFromSheet: roster.filter((s) => !seen.has(cleanUsn(s.usn))).length,
    ignoredColumns: map.ignored,
    readColumns: [
      ...map.components.map((c) => c.label),
      ...(map.attendance ? ["Classes held", "Classes attended"] : []),
    ],
  };
}

/** Whether the preview may be imported as it stands. */
export function isImportable(preview: ImportPreview): boolean {
  return (
    preview.errors.length === 0 &&
    preview.duplicates.length === 0 &&
    preview.changes.length + preview.attendanceChanges.length > 0
  );
}
