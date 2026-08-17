import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffDashboard } from "@/components/directory/StaffDashboard";
import { getFacultyStats, getOwnStaff } from "@/lib/queries/faculty";

export const metadata: Metadata = { title: "Department dashboard" };

export default async function HodDashboardPage() {
  const staff = await getOwnStaff();
  if (!staff) redirect("/account-blocked?reason=no-staff-record");

  const stats = await getFacultyStats();
  const firstName = staff.fullName.split(" ")[0];

  return (
    <StaffDashboard
      eyebrow={`Head of Department · ${staff.departmentCode}`}
      heading={`Welcome back, ${firstName}`}
      subheading={`${stats.total} student${stats.total === 1 ? "" : "s"} in your department`}
      basePath="/hod/students"
      emptyTitle="No students in your department yet"
      emptyDescription="Students appear here as soon as they register against your department and an administrator approves their account."
      stats={stats}
    />
  );
}
