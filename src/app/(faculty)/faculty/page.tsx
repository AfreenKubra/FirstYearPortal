import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffDashboard } from "@/components/directory/StaffDashboard";
import { getFacultyStats, getOwnStaff } from "@/lib/queries/faculty";

export const metadata: Metadata = { title: "Faculty dashboard" };

export default async function FacultyDashboardPage() {
  const staff = await getOwnStaff();
  if (!staff) redirect("/login");

  const stats = await getFacultyStats();
  const firstName = staff.fullName.split(" ")[0];

  return (
    <StaffDashboard
      eyebrow={staff.designation}
      heading={`Welcome back, ${firstName}`}
      subheading={`${stats.total} student${stats.total === 1 ? "" : "s"} assigned to you`}
      basePath="/faculty/students"
      reportsPath="/faculty/reports"
      emptyTitle="No students assigned yet"
      emptyDescription="Your visibility comes from assignments created by a portal administrator. Once you're assigned a department, semester, section, or mentoring group, those students appear here."
      stats={stats}
    />
  );
}
