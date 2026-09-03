import { NextResponse, type NextRequest } from "next/server";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listAllMatchingStudents } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";
import { marksCsvResponse } from "@/lib/marks/export";
import { listMarksForExport, listMarkComponents } from "@/lib/queries/marks";

export async function GET(request: NextRequest) {
  const staff = await getOwnStaff();
  if (!staff || !staff.roles.includes("hod")) {
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
    scopeNote: `Department: ${staff.departmentCode}`,
    filenamePrefix: `${staff.departmentCode.toLowerCase()}-marks`,
  });
}
