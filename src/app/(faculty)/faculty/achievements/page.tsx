import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerificationQueue } from "@/components/directory/VerificationQueue";
import { getOwnStaff } from "@/lib/queries/faculty";
import { getPendingVerifications } from "@/lib/queries/achievements";

export const metadata: Metadata = { title: "Achievements to verify" };

export default async function FacultyAchievementsPage() {
  const staff = await getOwnStaff();
  if (!staff) redirect("/login");

  // RLS narrows this to the caller's assigned students — the query itself
  // asks for every pending achievement.
  const pending = await getPendingVerifications();

  return (
    <VerificationQueue
      intro="Submissions from your assigned students, oldest first. Rejecting requires a remark so the student knows what to correct."
      emptyDescription="When a student you mentor records an achievement, it appears here for verification."
      studentBasePath="/faculty/students"
      pending={pending}
    />
  );
}
