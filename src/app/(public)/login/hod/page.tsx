import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Head of Department sign in" };

/**
 * The Head of Department portal entrance.
 *
 * A separate door, not separate security. The `portal` field the form posts
 * is checked inside the `login` server action against the role on the
 * `users` shadow table, so a faculty member or student who finds this URL is
 * signed straight back out rather than being quietly let through to a
 * different dashboard. The gate is the role check in the action; this page is
 * the sign above the door.
 */
export default function HodLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <AuthShell
      title="Head of Department"
      subtitle="Sign in to see and report on every student in your department."
      footer={
        <p>
          Not a head of department?{" "}
          <Link
            href="/login"
            className="rounded font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Use the main sign-in page
          </Link>
        </p>
      }
    >
      {searchParams.error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/25 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
        >
          {searchParams.error}
        </p>
      )}

      <div className="mb-4 rounded-lg border border-brass-300/60 bg-brass-50 px-3.5 py-2.5 text-sm text-brass-800">
        This entrance accepts Head of Department accounts only.
      </div>

      <LoginForm portal="hod" />
    </AuthShell>
  );
}
