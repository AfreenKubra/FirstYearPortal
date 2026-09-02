import { NextResponse, type NextRequest } from "next/server";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listAllMatchingStudents } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";
import { marksCsvResponse } from "@/lib/marks/export";
import { listMarksForExport, listMarkComponents } from "@/lib/queries/marks";

/**
 * Internal marks export (PRD 5.11).
 *
 * Takes the same filters as the student directory, so "the export follows
 * whatever is on screen" holds for marks as it does for the details export —
 * a filtered directory link and its marks report describe the same cohort.
 */
export async function GET(request: NextRequest) {
  const staff = await getOwnStaff();
  if (!staff) {
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
    generatedBy: `${staff.fullName} (${staff.employeeCode})`,
    scopeNote: "Students assigned to this faculty member",
    filenamePrefix: "my-students-marks",
  });
}
