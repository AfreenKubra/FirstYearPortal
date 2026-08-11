import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you haven't used on this portal before."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
