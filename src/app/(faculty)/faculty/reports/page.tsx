import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffReports } from "@/components/directory/StaffReports";
import { getOwnStaff } from "@/lib/queries/faculty";

export const metadata: Metadata = { title: "Reports" };

export default async function FacultyReportsPage() {
  const staff = await getOwnStaff();
  if (!staff) redirect("/account-blocked?reason=no-staff-record");

  return (
    <StaffReports
      basePath="/faculty"
      scopeNote="Covering the students assigned to you."
      guardianNote="Guardian contact appears only for students you are the assigned mentor of; for everyone else those columns read '(not permitted)'."
    />
  );
}
