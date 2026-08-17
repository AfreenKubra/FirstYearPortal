import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { branding } from "@/config/branding";

export const metadata: Metadata = { title: "Account unavailable" };

/**
 * Where an account that cannot use the portal lands.
 *
 * Two distinct situations end up here, and they deserve different sentences:
 * a suspended or rejected account (middleware sends those), and a staff
 * account whose profile row is missing so no role shell can render (the
 * layouts send those). The second case used to redirect to /login, which
 * middleware immediately bounced back — a redirect loop the user experienced
 * as a dead browser tab.
 */
const REASONS: Record<string, { title: string; body: string }> = {
  "no-staff-record": {
    title: "Your staff profile is incomplete",
    body:
      "This account has a staff role but no matching staff record, so there " +
      "is nothing for the portal to show. An administrator needs to finish " +
      "setting it up before you can sign in.",
  },
};

const DEFAULT_REASON = {
  title: "This account is not currently active",
  body:
    "Access to the portal has been suspended or the account request was not " +
    "approved. Your data has not been deleted.",
};

export default function AccountBlockedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason =
    (searchParams.reason && REASONS[searchParams.reason]) || DEFAULT_REASON;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md rounded-card border border-indigo-100 bg-white p-8 shadow-card">
        <Logo />
        <h1 className="mt-6 text-2xl text-indigo-950">{reason.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          {reason.body}
        </p>
        <p className="mt-4 text-sm text-ink-muted">
          To discuss this, contact{" "}
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
