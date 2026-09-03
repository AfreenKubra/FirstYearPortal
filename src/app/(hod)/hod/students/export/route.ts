import { NextResponse, type NextRequest } from "next/server";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listAllMatchingStudents } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";
import { directoryCsvResponse } from "@/lib/directory/export";
import { getMarksSummary, listMarkComponents } from "@/lib/queries/marks";

export async function GET(request: NextRequest) {
  const staff = await getOwnStaff();
  if (!staff || !staff.roles.includes("hod")) {
    return new NextResponse("Not authorised", { status: 403 });
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(raw);
  const rows = await listAllMatchingStudents(filters);

  // Three summary columns, so this file can answer "has this student been
  // marked at all" without opening the dedicated marks export.
  const components = await listMarkComponents();
  const marksSummary = await getMarksSummary(
    rows.map((r) => r.id),
    components,
  );

  return directoryCsvResponse({
    rows,
    filters,
    generatedBy: `${staff.fullName} (${staff.employeeCode})`,
    scopeNote: `Department: ${staff.departmentCode}`,
    filenamePrefix: `${staff.departmentCode.toLowerCase()}-students`,
    marksSummary,
  });
}
