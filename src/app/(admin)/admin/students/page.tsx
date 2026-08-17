import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DirectoryView } from "@/components/directory/DirectoryView";
import { getOwnAdmin } from "@/lib/queries/admin";
import { listAllMatchingStudents, listStudents } from "@/lib/queries/directory";
import { getLookups } from "@/lib/queries/student";
import { parseFilters } from "@/lib/faculty/filters";

export const metadata: Metadata = { title: "All students" };

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const admin = await getOwnAdmin();
  if (!admin) redirect("/account-blocked?reason=no-staff-record");

  const filters = parseFilters(searchParams);

  const [page, allRows, lookups] = await Promise.all([
    listStudents(filters),
    listAllMatchingStudents(filters),
    getLookups(),
  ]);

  return (
    <DirectoryView
      title="All students"
      intro="Every student in the institution, filterable by the same criteria faculty use. Guardian contact is visible to administrators."
      basePath="/admin/students"
      exportPath="/admin/students/export"
      emptyTitle="No students registered yet"
      emptyDescription="Students appear here as soon as they register and their account is approved."
      filters={filters}
      rows={page.rows}
      allRows={allRows}
      total={page.total}
      page={page.page}
      pageCount={page.pageCount}
      lookups={lookups}
    />
  );
}
