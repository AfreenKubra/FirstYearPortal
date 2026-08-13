import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerificationQueue } from "@/components/directory/VerificationQueue";
import { getOwnStaff } from "@/lib/queries/faculty";
import { getPendingVerifications } from "@/lib/queries/achievements";

export const metadata: Metadata = { title: "Achievements to verify" };

export default async function HodAchievementsPage() {
  const staff = await getOwnStaff();
  if (!staff) redirect("/account-blocked?reason=no-staff-record");

  const pending = await getPendingVerifications();

  return (
    <VerificationQueue
      intro={`Submissions from students across ${staff.departmentCode}, oldest first. Rejecting requires a remark so the student knows what to correct.`}
      emptyDescription="When a student in your department records an achievement, it appears here for verification."
      studentBasePath="/hod/students"
      pending={pending}
    />
  );
}
