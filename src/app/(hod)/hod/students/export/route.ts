import { NextResponse, type NextRequest } from "next/server";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listAllMatchingStudents } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";
import { directoryCsvResponse } from "@/lib/directory/export";

export async function GET(request: NextRequest) {
  const staff = await getOwnStaff();
  if (!staff || staff.role !== "hod") {
    return new NextResponse("Not authorised", { status: 403 });
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(raw);
  const rows = await listAllMatchingStudents(filters);

  return directoryCsvResponse({
    rows,
    filters,
    generatedBy: `${staff.fullName} (${staff.employeeCode})`,
    scopeNote: `Department: ${staff.departmentCode}`,
    filenamePrefix: `${staff.departmentCode.toLowerCase()}-students`,
  });
}
