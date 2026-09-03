import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarksWorkspace } from "@/components/marks/MarksWorkspace";
import { getOwnStaff } from "@/lib/queries/faculty";

export const metadata: Metadata = { title: "Internal marks" };

/**
 * The same workspace the faculty screen renders. A head of department sees
 * their whole department rather than an assignment list, and that difference
 * is decided by RLS inside the roster query, not here.
 */
export default async function HodMarksPage({
  searchParams,
}: {
  searchParams: { subject?: string; section?: string };
}) {
  const staff = await getOwnStaff();
  if (!staff) redirect("/login");

  return (
    <MarksWorkspace
      basePath="/hod/marks"
      departmentCode={staff.departmentCode}
      subjectId={searchParams.subject}
      section={searchParams.section || undefined}
      // A HOD may assign the teachers for their own department (0026), and
      // had the permission with nowhere to exercise it until this screen.
      canAssignTeachers
    />
  );
}
