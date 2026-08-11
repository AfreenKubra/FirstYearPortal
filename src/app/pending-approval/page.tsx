import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { branding } from "@/config/branding";

export const metadata: Metadata = { title: "Awaiting approval" };

export default function PendingApprovalPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md rounded-card border border-indigo-100 bg-white p-8 shadow-card">
        <Logo />
        <h1 className="mt-6 text-2xl text-indigo-950">
          Your account is awaiting approval
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Faculty and administrator accounts are approved by a portal
          administrator before they can be used. You&apos;ll be able to sign in
          normally once yours is approved.
        </p>
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
