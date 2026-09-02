import { NextResponse, type NextRequest } from "next/server";
import { getOwnAdmin } from "@/lib/queries/admin";
import { listAllMatchingStudents } from "@/lib/queries/directory";
import { parseFilters } from "@/lib/faculty/filters";
import { directoryCsvResponse } from "@/lib/directory/export";
import { getMarksSummary, listMarkComponents } from "@/lib/queries/marks";

/**
 * Student-level export for administrators.
 *
 * Separate from `/admin/export`, which reports aggregates only. Both read
 * through `student_directory`, so the guardian-masking rules are applied once,
 * in the database, rather than being reimplemented per route.
 */
export async function GET(request: NextRequest) {
  const admin = await getOwnAdmin();
  if (!admin) {
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
    generatedBy: `${admin.fullName} (${admin.employeeCode})`,
    scopeNote: "Institution-wide",
    filenamePrefix: "institution-students",
    marksSummary,
  });
}
