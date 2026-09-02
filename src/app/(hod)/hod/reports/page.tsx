import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffReports } from "@/components/directory/StaffReports";
import { getOwnStaff } from "@/lib/queries/faculty";

export const metadata: Metadata = { title: "Reports" };

export default async function HodReportsPage() {
  const staff = await getOwnStaff();
  if (!staff || !staff.roles.includes("hod")) {
    redirect("/account-blocked?reason=no-staff-record");
  }

  return (
    <StaffReports
      basePath="/hod"
      scopeNote={`Covering every student in ${staff.departmentCode}.`}
      guardianNote="Guardian contact is included, because a head of department is who has to make that call."
    />
  );
}
