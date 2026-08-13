import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DirectoryView } from "@/components/directory/DirectoryView";
import { getOwnStaff } from "@/lib/queries/faculty";
import { listAllMatchingStudents, listStudents } from "@/lib/queries/directory";
import { getLookups } from "@/lib/queries/student";
import { parseFilters } from "@/lib/faculty/filters";

export const metadata: Metadata = { title: "My students" };

export default async function FacultyStudentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const staff = await getOwnStaff();
  if (!staff) redirect("/login");

  const filters = parseFilters(searchParams);

  const [page, allRows, lookups] = await Promise.all([
    listStudents(filters),
    listAllMatchingStudents(filters),
    getLookups(),
  ]);

  return (
    <DirectoryView
      title="My students"
      intro="Only students assigned to you appear here. Guardian contact is shown for students you mentor."
      basePath="/faculty/students"
      exportPath="/faculty/students/export"
      emptyTitle="No students assigned yet"
      emptyDescription="Your visibility comes from assignments created by a portal administrator."
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
