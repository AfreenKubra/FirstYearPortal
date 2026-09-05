import { NextResponse, type NextRequest } from "next/server";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listAllMatchingStudents } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";
import { parseReportFormat } from "@/lib/directory/export";
import { directoryReportResponse } from "@/lib/directory/export-formats";
import { getMarksSummary, listMarkComponents } from "@/lib/queries/marks";

export async function GET(request: NextRequest) {
  const staff = await getOwnStaff();
  if (!staff) {
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

  return directoryReportResponse(
    parseReportFormat(request.nextUrl.searchParams.get("format")),
    {
    rows,
    filters,
    generatedBy: `${staff.fullName} (${staff.employeeCode})`,
    scopeNote: "Students assigned to this faculty member",
    filenamePrefix: "my-students",
    marksSummary,
    },
  );
}
