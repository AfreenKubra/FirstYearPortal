import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { StaffRegisterForm } from "@/components/registration/StaffRegisterForm";
import { getLookups } from "@/lib/queries/student";

export const metadata: Metadata = { title: "Request a staff account" };

export default async function StaffRegisterPage() {
  const { departments } = await getLookups();

  return (
    <AuthShell
      title="Request a staff account"
      subtitle="For faculty and administrators. An existing administrator approves the request before the account becomes active."
      aside={{
        heading: "Staff access is granted, never claimed.",
        points: [
          "Faculty see only the students assigned to them by an administrator.",
          "Guardian contact is visible only for students you personally mentor.",
          "Administrators see institution-wide analytics and approve new accounts.",
        ],
      }}
      footer={
        <p>
          Are you a student?{" "}
          <Link
            href="/register"
            className="rounded font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Create a student account
          </Link>{" "}
          · Already approved?{" "}
          <Link
            href="/login"
            className="rounded font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <StaffRegisterForm departments={departments} />
    </AuthShell>
  );
}
