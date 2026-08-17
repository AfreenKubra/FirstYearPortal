import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DirectoryView } from "@/components/directory/DirectoryView";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listAllMatchingStudents, listStudents } from "@/lib/queries/directory";
import { getLookups } from "@/lib/queries/student";
import { parseFilters } from "@/lib/faculty/filters";

export const metadata: Metadata = { title: "Department students" };

export default async function HodStudentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const staff = await getOwnStaff();
  if (!staff) redirect("/account-blocked?reason=no-staff-record");

  const filters = parseFilters(searchParams);

  const [page, allRows, lookups] = await Promise.all([
    listStudents(filters),
    listAllMatchingStudents(filters),
    getLookups(),
  ]);

  return (
    <DirectoryView
      title="Department students"
      intro={`Every student in ${staff.departmentCode}, filterable and exportable. Guardian contact is shown because you head this department.`}
      basePath="/hod/students"
      exportPath="/hod/students/export"
      emptyTitle="No students in your department yet"
      emptyDescription="Students appear here once they register against your department and an administrator approves their account."
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
