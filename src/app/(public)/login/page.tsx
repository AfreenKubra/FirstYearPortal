import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  "account-incomplete":
    "Your account setup did not finish. Contact the portal administrator.",
  "expired-link": "That link has expired. Request a new one below.",
  "invalid-link": "That link was not valid. Request a new one below.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error
    ? ERROR_MESSAGES[searchParams.error]
    : undefined;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the email address and password you registered with."
      footer={
        <div className="space-y-1">
          <p>
            New here?{" "}
            <Link
              href="/register"
              className="rounded font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              Create a student account
            </Link>
          </p>
          <p>
            Head of department?{" "}
            <Link
              href="/login/hod"
              className="rounded font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              Use the HOD entrance
            </Link>
          </p>
        </div>
      }
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/25 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
