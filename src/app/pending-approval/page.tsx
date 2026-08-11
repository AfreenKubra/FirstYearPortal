import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { branding } from "@/config/branding";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Awaiting approval" };

/**
 * Shown to any account with `status = 'pending'`. Since migration 0008 that
 * includes students, so the copy is role-aware — telling a first-year student
 * their "faculty account" is under review would just be confusing.
 */
export default async function PendingApprovalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = data?.role ?? null;
  }

  const isStudent = role === "student";

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md rounded-card border border-indigo-100 bg-white p-8 shadow-card">
        <Logo />
        <h1 className="mt-6 text-2xl text-indigo-950">
          Your account is awaiting approval
        </h1>

        {isStudent ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Every new account is checked by a portal administrator before it
              becomes active. Yours is in the queue.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Everything you entered when you registered has been saved. Once
              your account is approved you can sign in and carry on from where
              you left off — nothing needs to be filled in again.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Faculty and administrator accounts are approved by a portal
            administrator before they can be used. You&apos;ll be able to sign
            in normally once yours is approved.
          </p>
        )}

        <p className="mt-4 text-sm text-ink-muted">
          If this is taking longer than expected, contact{" "}
          <a
            href={`mailto:${branding.contacts.support}`}
            className="rounded font-medium text-indigo-700 underline hover:text-indigo-900"
          >
            {branding.contacts.support}
          </a>
          .
        </p>

        <div className="mt-6 border-t border-indigo-100 pt-4">
          <LogoutButton className="px-0" />
        </div>
      </div>
    </main>
  );
}
