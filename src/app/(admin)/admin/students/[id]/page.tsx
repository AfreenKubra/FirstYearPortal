import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StudentProfile } from "@/components/directory/StudentProfile";
import { getOwnAdmin } from "@/lib/queries/admin";
import { getStudentDetail } from "@/lib/queries/directory";
import { getAchievementsForStudent } from "@/lib/queries/achievements";

export const metadata: Metadata = { title: "Student profile" };

export default async function AdminStudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = await getOwnAdmin();
  if (!admin) redirect("/account-blocked?reason=no-staff-record");

  const [detail, achievements] = await Promise.all([
    getStudentDetail(params.id),
    getAchievementsForStudent(params.id),
  ]);

  if (!detail) notFound();

  return (
    <StudentProfile
      detail={detail}
      achievements={achievements}
      backHref="/admin/students"
      backLabel="Back to all students"
      canVerify
      mentorBadge="Administrator access"
    />
  );
}
