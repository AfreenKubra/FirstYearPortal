"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/FormStatus";
import { useActionState } from "@/lib/actions/use-action-state";
import { runSheetImport, type SheetImportState } from "@/lib/actions/marks-sheet";
import { isImportable, type ImportPreview } from "@/lib/marks/sheet-import";

const IDLE: SheetImportState = { status: "idle", message: null };

function storageKey(subjectId: string) {
  return `fyp-marks-sheet:${subjectId}`;
}

function mark(value: number | null) {
  return value === null ? "—" : String(value);
}

/**
 * Import a subject's marks from its Google Sheet tab.
 *
 * Preview, then import. Nothing is written by the first button, and the
 * second writes only what the first showed — the server re-reads the sheet
 * and refuses if it changed in between. The link is remembered per subject in
 * this browser, so next time it is one click.
 */
export function SheetImportPanel({
  subjectId,
  subjectLabel,
  section,
}: {
  subjectId: string;
  subjectLabel: string;
  section?: string;
}) {
  const [state, formAction] = useActionState<SheetImportState>(runSheetImport, IDLE);
  const [link, setLink] = useState("");

  // Restore the remembered link for this subject.
  useEffect(() => {
    try {
      setLink(localStorage.getItem(storageKey(subjectId)) ?? "");
    } catch {
      setLink("");
    }
  }, [subjectId]);

  // Remember a link once Google has actually served it.
  useEffect(() => {
    if ((state.status === "preview" || state.status === "done") && state.sheetUrl) {
      try {
        localStorage.setItem(storageKey(subjectId), state.sheetUrl);
      } catch {
        // Private browsing: the link simply is not remembered.
      }
    }
  }, [state.status, state.sheetUrl, subjectId]);

  const preview = state.status === "preview" ? state.preview : undefined;

  return (
    <Card as="section">
      <CardHeader
        title="Import from Google Sheets"
        description={`Pull ${subjectLabel} marks from its tab in a Google Sheet. You see every change before anything is saved.`}
      />
      <CardBody className="space-y-4">
        <details className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3.5 py-2.5 text-sm">
          <summary className="cursor-pointer font-medium text-indigo-900">
            How to set up the sheet
          </summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ink-muted">
            <li>
              One tab per subject. First row headed <strong>USN</strong>,{" "}
              <strong>1st IA</strong>, <strong>2nd IA</strong> (IA1, IA 1 and
              First IA are recognised too). Other columns such as Name are ignored.
            </li>
            <li>
              One student per row. A <strong>blank</strong> cell leaves that
              mark as it is in the portal; <strong>AB</strong> means absent and
              removes any mark.
            </li>
            <li>
              Share → General access → <strong>Anyone with the link</strong> →
              Viewer. Open this subject&apos;s tab and copy the address bar.
            </li>
          </ol>
          <p className="mt-2 text-xs text-ink-faint">
            Anyone who has the link can see every mark on that sheet, so share
            it only with faculty.
          </p>
        </details>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="section" value={section ?? ""} />
          <input type="hidden" name="fingerprint" value={state.fingerprint ?? ""} />

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-ink">Link to this subject&apos;s tab</span>
            <input
              type="url"
              name="sheetUrl"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=…"
              className="h-11 w-full rounded-lg border border-indigo-200 bg-white px-3.5 text-sm text-ink shadow-sm hover:border-indigo-300 focus:border-indigo-500"
              required
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="preview" pendingLabel="Reading the sheet…" variant="secondary">
              Preview import
            </SubmitButton>
            {preview && isImportable(preview) && (
              <SubmitButton name="intent" value="import" pendingLabel="Importing…">
                Import {preview.changes.length} change{preview.changes.length === 1 ? "" : "s"}
              </SubmitButton>
            )}
          </div>

          {state.message && (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={[
                "rounded-lg border px-3.5 py-2.5 text-sm",
                state.status === "error"
                  ? "border-danger/25 bg-danger/5 text-danger"
                  : state.status === "done"
                    ? "border-success/25 bg-success/5 text-success"
                    : "border-brass-300 bg-brass-50 text-brass-800",
              ].join(" ")}
            >
              {state.message}
            </p>
          )}
        </form>

        {preview && <PreviewReport preview={preview} />}
      </CardBody>
    </Card>
  );
}

function PreviewReport({ preview }: { preview: ImportPreview }) {
  const blocked = preview.errors.length > 0 || preview.duplicates.length > 0;

  return (
    <div className="space-y-4 border-t border-indigo-100 pt-4">
      <p className="text-sm text-ink">
        Read <strong>{preview.readColumns.join(", ")}</strong>.{" "}
        <strong className="tabular-nums">{preview.changes.length}</strong> to change,{" "}
        <span className="tabular-nums">{preview.unchanged}</span> already match.
        {preview.changes.length === 0 && !blocked && " Nothing to import — the portal already matches the sheet."}
      </p>

      {preview.errors.length > 0 && (
        <div className="rounded-lg border border-danger/25 bg-danger/5 p-3.5">
          <p className="text-sm font-medium text-danger">
            Fix these in the sheet first — nothing will be imported until they are.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {preview.errors.map((e) => (
              <li key={`${e.row}-${e.componentLabel}`}>
                Row {e.row} · {e.usn} · {e.componentLabel}: &ldquo;{e.value}&rdquo; — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.duplicates.length > 0 && (
        <div className="rounded-lg border border-danger/25 bg-danger/5 p-3.5 text-sm">
          <p className="font-medium text-danger">These USNs appear on more than one row:</p>
          <p className="mt-1 text-ink">{preview.duplicates.join(", ")}</p>
        </div>
      )}

      {preview.changes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Marks that will change</caption>
            <thead>
              <tr className="border-b border-indigo-100 text-xs uppercase tracking-wide text-ink-faint">
                <th scope="col" className="py-2 pr-3 font-medium">USN</th>
                <th scope="col" className="py-2 pr-3 font-medium">Name</th>
                <th scope="col" className="py-2 pr-3 font-medium">Component</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Now</th>
                <th scope="col" className="py-2 text-right font-medium">After import</th>
              </tr>
            </thead>
            <tbody>
              {preview.changes.map((c) => (
                <tr key={`${c.studentId}-${c.componentCode}`} className="border-b border-indigo-50">
                  <td className="py-2 pr-3 font-mono text-xs text-ink-muted">{c.usn}</td>
                  <td className="py-2 pr-3 text-ink">{c.fullName}</td>
                  <td className="py-2 pr-3 text-ink-muted">{c.componentLabel}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink-faint">{mark(c.from)}</td>
                  <td className="py-2 text-right tabular-nums font-medium text-indigo-950">
                    {c.to === null ? "Absent (removed)" : c.to}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="space-y-1 text-xs text-ink-faint">
        {preview.notInClass.length > 0 && (
          <li>
            Skipped {preview.notInClass.length} USN{preview.notInClass.length === 1 ? "" : "s"} not in this class:{" "}
            {preview.notInClass.slice(0, 12).join(", ")}
            {preview.notInClass.length > 12 ? "…" : ""}
          </li>
        )}
        {preview.missingFromSheet > 0 && (
          <li>
            {preview.missingFromSheet} student{preview.missingFromSheet === 1 ? " is" : "s are"} in the class but not on
            the sheet — their marks are left as they are.
          </li>
        )}
        {preview.ignoredColumns.length > 0 && (
          <li>Columns not read: {preview.ignoredColumns.join(", ")}</li>
        )}
      </ul>
    </div>
  );
}
