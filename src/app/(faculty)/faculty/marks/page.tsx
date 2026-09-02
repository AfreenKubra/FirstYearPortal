import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarksWorkspace } from "@/components/marks/MarksWorkspace";
import { getOwnStaff } from "@/lib/queries/faculty";

export const metadata: Metadata = { title: "Internal marks" };

export default async function FacultyMarksPage({
  searchParams,
}: {
  searchParams: { subject?: string; section?: string };
}) {
  const staff = await getOwnStaff();
  if (!staff) redirect("/login");

  return (
    <MarksWorkspace
      basePath="/faculty/marks"
      departmentCode={staff.departmentCode}
      subjectId={searchParams.subject}
      section={searchParams.section || undefined}
    />
  );
}
