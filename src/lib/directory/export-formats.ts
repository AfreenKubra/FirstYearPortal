import "server-only";

import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildDirectoryReport,
  directoryCsvResponse,
  type DirectoryReport,
  type DirectoryReportInput,
  type ReportFormat,
} from "./export";

/**
 * The PDF rendering of the directory report, and the dispatcher the export
 * routes call.
 *
 * Kept out of `export.ts` so that file stays free of the rendering library
 * and can be reasoned about — and tested — as pure report shaping.
 *
 * Both formats render from `buildDirectoryReport()`, so they cannot disagree
 * about columns, order, or values: the printed copy and the spreadsheet a
 * reader opens from the CSV show the same figures in the same order.
 */

/** One entry point for the export routes: pick a format, get a file. */
export async function directoryReportResponse(
  format: ReportFormat,
  input: DirectoryReportInput,
): Promise<NextResponse> {
  if (format === "pdf") return directoryPdfResponse(input);
  return directoryCsvResponse(input);
}

function fileHeaders(filename: string, contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    // Student personal data — no proxy or browser may keep a copy.
    "Cache-Control": "no-store, private",
  };
}

function filename(report: DirectoryReport, extension: string): string {
  return `${report.filenamePrefix}-${report.generatedAt.slice(0, 10)}.${extension}`;
}

/**
 * A printable PDF of the same report.
 *
 * Landscape and small type because the table is wide: eighteen columns of
 * student detail will not fit portrait A4 at a readable size, and shrinking
 * the font further to force it would defeat the point of a printable copy.
 * The provenance block is repeated at the top rather than left to the
 * filename, since a printed page carries no filename at all.
 */
export function directoryPdfResponse(input: DirectoryReportInput): NextResponse {
  const report = buildDirectoryReport(input);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text(report.title, 40, 40);

  doc.setFontSize(9);
  let y = 58;
  for (const [label, value] of report.meta) {
    doc.text(`${label}: ${value}`, 40, y);
    y += 12;
  }

  autoTable(doc, {
    startY: y + 8,
    head: [report.columns],
    body: report.data.map((row) => row.map((cell) => (cell === null ? "" : String(cell)))),
    styles: { fontSize: 6.5, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [63, 61, 134], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: 20, right: 20 },
    // Page numbers, because a printed export gets separated and reordered.
    didDrawPage: (data) => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.text(
        `Page ${data.pageNumber} of ${page}`,
        doc.internal.pageSize.getWidth() - 60,
        doc.internal.pageSize.getHeight() - 16,
      );
    },
  });

  const bytes = doc.output("arraybuffer");

  return new NextResponse(bytes, {
    headers: fileHeaders(filename(report, "pdf"), "application/pdf"),
  });
}
