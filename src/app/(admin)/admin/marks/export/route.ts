import { NextResponse, type NextRequest } from "next/server";
import { getOwnAdmin } from "@/lib/queries/admin";
import { listAllMatchingStudents } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";
import { marksCsvResponse } from "@/lib/marks/export";
import { listMarksForExport, listMarkComponents } from "@/lib/queries/marks";

/**
 * Institution-wide internal marks export (PRD 5.11).
 *
 * The same builder the faculty and HOD routes use; what differs is only how
 * far RLS lets the caller see, which is decided in the database rather than
 * here — the same arrangement as the three student-directory exports.
 *
 * This one spans every department, so it is the largest file the portal
 * produces: one row per student per subject. Narrow it with the directory
 * filters first rather than exporting the institution and filtering in Excel.
 */
export async function GET(request: NextRequest) {
  const admin = await getOwnAdmin();
  if (!admin) {
    return new NextResponse("Not authorised", { status: 403 });
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(raw);

  const students = await listAllMatchingStudents(filters);
  const components = await listMarkComponents();
  const rows = await listMarksForExport(
    students.map((s) => s.id),
    components,
  );

  return marksCsvResponse({
    rows,
    students,
    components,
    filters,
    generatedBy: `${admin.fullName} (${admin.employeeCode})`,
    scopeNote: "Institution-wide",
    filenamePrefix: "institution-marks",
  });
}
