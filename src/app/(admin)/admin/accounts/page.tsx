import type { Metadata } from "next";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { AccountDecision } from "@/components/admin/AccountDecision";
import { RoleControl } from "@/components/admin/RoleControl";
import { getAccountQueue } from "@/lib/queries/admin";
import { roleLabel } from "@/config/roles";

export const metadata: Metadata = { title: "Account approvals" };

const STATUS_STYLES: Record<string, string> = {
  pending: "border-warning/30 bg-warning/5 text-warning",
  active: "border-success/30 bg-success/5 text-success",
  rejected: "border-danger/30 bg-danger/5 text-danger",
  suspended: "border-danger/30 bg-danger/5 text-danger",
};

/** `rejected` is the stored value; "Declined" is what an admin calls it. */
const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting decision",
  active: "Accepted",
  rejected: "Declined",
  suspended: "Suspended",
};

/** First letters of the first two words, for the avatar fallback. */
function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        "rounded-md border px-2 py-1 text-xs font-medium",
        STATUS_STYLES[status] ??
          "border-indigo-100 bg-indigo-50 text-indigo-800",
      ].join(" ")}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function AccountCard({
  account,
}: {
  account: {
    userId: string;
    email: string;
    role: string;
    roles: string[];
    hasStaffRecord: boolean;
    status: string;
    createdAt: string;
    fullName: string | null;
    identifier: string | null;
    departmentCode: string | null;
    designation: string | null;
    photoUrl: string | null;
    isSelf: boolean;
  };
}) {
  const displayName = account.fullName ?? account.email;

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 py-4">
      <div className="flex min-w-0 gap-3">
        {/* The student's own uploaded photo where there is one, initials
            otherwise — an account with no photo still needs to occupy the
            same space, or the rows jog left and right down the list. */}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-indigo-100 bg-indigo-50 text-sm font-semibold text-indigo-800">
          {account.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed
            // Supabase URL, expires hourly; not a candidate for next/image's
            // optimiser, which would cache a URL that has already expired.
            <img
              src={account.photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials(displayName)}</span>
          )}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-indigo-950">{displayName}</p>
            <StatusPill status={account.status} />
            {/* The primary role first and marked, then any additional ones —
              an account holding two roles should read as holding two. */}
            {[
              account.role,
              ...account.roles.filter((r) => r !== account.role),
            ].map((role) => (
              <span
                key={role}
                className={[
                  "rounded-md border px-2 py-0.5 text-xs font-medium",
                  role === account.role
                    ? "border-indigo-100 bg-indigo-50 text-indigo-800"
                    : "border-brass-300/60 bg-brass-50 text-brass-800",
                ].join(" ")}
              >
                {roleLabel(role)}
                {role === account.role && account.roles.length > 1 && (
                  <span className="ml-1 text-[0.625rem] opacity-70">home</span>
                )}
              </span>
            ))}
          </div>
          <p className="mt-1 break-all text-sm text-ink-muted">
            {account.email}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {[
              account.designation,
              account.departmentCode,
              account.identifier,
              `Requested ${new Date(account.createdAt).toLocaleDateString()}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {!account.fullName && (
            <p className="mt-1 text-xs text-warning">
              No profile attached — this account signed up but never completed
              its record.
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-start gap-4">
        <RoleControl
          userId={account.userId}
          email={account.email}
          primaryRole={account.role}
          roles={account.roles}
          hasStaffRecord={account.hasStaffRecord}
          name={displayName}
          isSelf={account.isSelf}
        />
        <AccountDecision
          userId={account.userId}
          status={account.status}
          name={displayName}
          isSelf={account.isSelf}
        />
      </div>
    </li>
  );
}

export default async function AdminAccountsPage() {
  const { pending, recent } = await getAccountQueue();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">
          Account approvals
        </h1>
      </header>

      <Card as="section">
        <CardHeader
          title="Awaiting decision"
          description={
            pending.length === 0
              ? undefined
              : `${pending.length} account${pending.length === 1 ? "" : "s"} pending`
          }
        />
        <CardBody className={pending.length === 0 ? undefined : "py-0"}>
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              description="New faculty or administrator requests will appear here for approval."
            />
          ) : (
            <ul className="divide-y divide-indigo-100">
              {pending.map((account) => (
                <AccountCard key={account.userId} account={account} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {recent.length > 0 && (
        <Card as="section">
          <CardHeader
            title="Recently decided"
            description="Approved, rejected, or suspended accounts. You can still change these."
          />
          <CardBody className="py-0">
            <ul className="divide-y divide-indigo-100">
              {recent.map((account) => (
                <AccountCard key={account.userId} account={account} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
