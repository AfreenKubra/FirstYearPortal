"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnStaff } from "@/lib/queries/faculty";
import { getMarksGrid } from "@/lib/queries/marks";
import { getSubjectAttendance } from "@/lib/queries/attendance";
import {
  buildPreview,
  csvExportUrl,
  isImportable,
  mapColumns,
  parseCsv,
  parseSheetUrl,
  type ImportPreview,
} from "@/lib/marks/sheet-import";

/**
 * Importing internal marks from a Google Sheet (see `lib/marks/sheet-import.ts`
 * for the rules a cell follows).
 *
 * Two steps, and the second does not trust the first. `previewSheetImport`
 * fetches the sheet and reports what would change. `applySheetImport` fetches
 * it *again*, rebuilds the preview on the server, and writes only if the
 * sheet's fingerprint still matches the one the teacher reviewed. Nothing the
 * browser sends back is used as a mark: it sends a link, a subject, and a
 * fingerprint, never the figures themselves.
 *
 * Writes go through the caller's own session, so the same row-level security
 * that governs the marks grid governs this — since 0026, only the subject's
 * assigned teacher, its head of department, and administrators may write.
 */

export type SheetImportState = {
  status: "idle" | "error" | "preview" | "done";
  message: string | null;
  preview?: ImportPreview;
  /** sha256 of the CSV the preview was built from. */
  fingerprint?: string;
  sheetUrl?: string;
};

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 12_000;

type Fetched = { ok: true; csv: string } | { ok: false; error: string };

async function fetchSheetCsv(sheetUrl: string): Promise<Fetched> {
  const parsed = parseSheetUrl(sheetUrl);
  if (!parsed.ok) return parsed;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Built from the id alone — the pasted text is never fetched directly.
    const response = await fetch(csvExportUrl(parsed.ref), {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    if (response.status === 404) {
      return { ok: false, error: "Google could not find that sheet. Check the link." };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Google refused the request (${response.status}). Check the sheet is shared as "Anyone with the link can view".`,
      };
    }

    const text = await response.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, error: "That tab is too large to be a class's marks. Link the one subject's tab." };
    }

    // A private sheet does not fail — Google answers with its sign-in page.
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("text/html") || /^\s*<(!doctype|html)/i.test(text)) {
      return {
        ok: false,
        error: 'The sheet is private. In Google Sheets choose Share → General access → "Anyone with the link" (Viewer), then try again.',
      };
    }

    return { ok: true, csv: text };
  } catch (error) {
    const aborted = (error as Error).name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "Google took too long to answer. Try again in a moment."
        : "Could not reach Google Sheets. Check your connection and try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function fingerprintOf(csv: string): string {
  return createHash("sha256").update(csv).digest("hex");
}

async function buildFromSheet(
  sheetUrl: string,
  subjectId: string,
  section: string | null,
): Promise<
  | { ok: true; preview: ImportPreview; fingerprint: string }
  | { ok: false; error: string }
> {
  const fetched = await fetchSheetCsv(sheetUrl);
  if (!fetched.ok) return fetched;

  const rows = parseCsv(fetched.csv);
  if (rows.length < 2) {
    return { ok: false, error: "That tab has a header row but no students under it." };
  }

  // The same roster and marks the grid shows, through the same RLS.
  const grid = await getMarksGrid(subjectId, section);
  if (!grid) return { ok: false, error: "That subject is no longer available." };
  if (grid.students.length === 0) {
    return { ok: false, error: "There is no class on file for this subject to import into." };
  }

  const mapped = mapColumns(rows[0], grid.components);
  if (!mapped.ok) return mapped;

  const current = new Map<string, number>();
  for (const student of grid.students) {
    for (const cell of student.cells) {
      if (cell.marks !== null) current.set(`${student.studentId}:${cell.componentCode}`, cell.marks);
    }
  }

  const currentAttendance = mapped.map.attendance
    ? await getSubjectAttendance(
        subjectId,
        grid.students.map((s) => s.studentId),
      )
    : new Map();

  const preview = buildPreview(
    rows,
    mapped.map,
    grid.students.map((s) => ({ id: s.studentId, usn: s.usn, fullName: s.fullName })),
    current,
    currentAttendance,
  );

  return { ok: true, preview, fingerprint: fingerprintOf(fetched.csv) };
}

function readForm(formData: FormData) {
  const section = String(formData.get("section") ?? "").trim();
  return {
    sheetUrl: String(formData.get("sheetUrl") ?? ""),
    subjectId: String(formData.get("subjectId") ?? ""),
    section: section ? section.toUpperCase() : null,
  };
}

/** One form, two buttons: `intent` says which step was asked for. */
export async function runSheetImport(
  prev: SheetImportState,
  formData: FormData,
): Promise<SheetImportState> {
  return formData.get("intent") === "import"
    ? applySheetImport(prev, formData)
    : previewSheetImport(prev, formData);
}

export async function previewSheetImport(
  _prev: SheetImportState,
  formData: FormData,
): Promise<SheetImportState> {
  const staff = await getOwnStaff();
  if (!staff) return { status: "error", message: "Staff access required." };

  const { sheetUrl, subjectId, section } = readForm(formData);
  if (!subjectId) return { status: "error", message: "Choose a subject first." };

  const built = await buildFromSheet(sheetUrl, subjectId, section);
  if (!built.ok) return { status: "error", message: built.error, sheetUrl };

  return {
    status: "preview",
    message: null,
    preview: built.preview,
    fingerprint: built.fingerprint,
    sheetUrl,
  };
}

export async function applySheetImport(
  _prev: SheetImportState,
  formData: FormData,
): Promise<SheetImportState> {
  const staff = await getOwnStaff();
  if (!staff) return { status: "error", message: "Staff access required." };

  const { sheetUrl, subjectId, section } = readForm(formData);
  const reviewed = String(formData.get("fingerprint") ?? "");

  const built = await buildFromSheet(sheetUrl, subjectId, section);
  if (!built.ok) return { status: "error", message: built.error, sheetUrl };

  // Someone edited the sheet after the preview. Writing now would put figures
  // in the portal that nobody looked at.
  if (built.fingerprint !== reviewed) {
    return {
      status: "preview",
      message: "The sheet changed after you previewed it. Here is the new preview — check it and import again.",
      preview: built.preview,
      fingerprint: built.fingerprint,
      sheetUrl,
    };
  }

  const { preview } = built;
  if (!isImportable(preview)) {
    return {
      status: "preview",
      message: "Nothing was imported — fix the problems listed below first.",
      preview,
      fingerprint: built.fingerprint,
      sheetUrl,
    };
  }

  const supabase = createClient();
  const toSet = preview.changes.filter((c) => c.to !== null);
  const toRemove = preview.changes.filter((c) => c.to === null);

  if (toSet.length > 0) {
    const { error } = await supabase.from("student_subject_marks").upsert(
      toSet.map((c) => ({
        student_id: c.studentId,
        subject_id: subjectId,
        component_code: c.componentCode,
        marks: c.to as number,
        // Snapshotted, as the grid does — see migration 0025.
        max_marks: c.maxMarks,
      })),
      { onConflict: "student_id,subject_id,component_code" },
    );

    if (error) {
      return {
        status: "error",
        message:
          "Could not save these marks. Only the subject's assigned teacher, the head of department, and administrators may edit marks — check you are down to teach this subject.",
        sheetUrl,
      };
    }
  }

  for (const change of toRemove) {
    await supabase
      .from("student_subject_marks")
      .delete()
      .eq("student_id", change.studentId)
      .eq("subject_id", subjectId)
      .eq("component_code", change.componentCode);
  }

  if (preview.attendanceChanges.length > 0) {
    const { error } = await supabase.from("student_subject_attendance").upsert(
      preview.attendanceChanges.map((c) => ({
        student_id: c.studentId,
        subject_id: subjectId,
        classes_held: c.to.held,
        classes_attended: c.to.attended,
      })),
      { onConflict: "student_id,subject_id" },
    );

    if (error) {
      return {
        status: "error",
        message:
          toSet.length + toRemove.length > 0
            ? "Marks were imported, but attendance could not be saved. Only the subject's assigned teacher, the head of department, and administrators may record it."
            : "Could not save attendance. Only the subject's assigned teacher, the head of department, and administrators may record it.",
        sheetUrl,
      };
    }
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await createAdminClient().from("audit_logs").insert({
      actor_user_id: user?.id ?? null,
      action: "marks.import_sheet",
      entity_type: "student_subject_marks",
      entity_id: subjectId,
      metadata: {
        faculty_id: staff.id,
        recorded: toSet.length,
        removed: toRemove.length,
        attendance: preview.attendanceChanges.length,
        fingerprint: built.fingerprint,
      },
    });
  } catch {
    // An audit failure must not undo an import the teacher confirmed.
  }

  revalidatePath("/faculty/marks");
  revalidatePath("/hod/marks");

  revalidatePath("/dashboard");

  const parts: string[] = [];
  if (toSet.length > 0) parts.push(`${toSet.length} mark${toSet.length === 1 ? "" : "s"} imported`);
  if (toRemove.length > 0) parts.push(`${toRemove.length} removed as absent`);
  const attendanceCount = preview.attendanceChanges.length;
  if (attendanceCount > 0) {
    parts.push(`attendance updated for ${attendanceCount} student${attendanceCount === 1 ? "" : "s"}`);
  }

  const notes: string[] = [];
  if (toSet.length + toRemove.length > 0) notes.push("Marks show to students once you release them");
  if (attendanceCount > 0) notes.push("attendance is visible to them now");

  return {
    status: "done",
    message: `${parts.join(", ")}. ${notes.join("; ")}.`,
    sheetUrl,
  };
}
