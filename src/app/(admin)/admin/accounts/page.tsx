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

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        "rounded-md border px-2 py-1 text-xs font-medium",
        STATUS_STYLES[status] ?? "border-indigo-100 bg-indigo-50 text-indigo-800",
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
    status: string;
    createdAt: string;
    fullName: string | null;
    identifier: string | null;
    departmentCode: string | null;
    designation: string | null;
    isSelf: boolean;
  };
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-indigo-950">
            {account.fullName ?? account.email}
          </p>
          <StatusPill status={account.status} />
          <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
            {roleLabel(account.role)}
          </span>
        </div>
        <p className="mt-1 break-all text-sm text-ink-muted">{account.email}</p>
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

      <div className="flex shrink-0 flex-wrap items-start gap-4">
        <RoleControl
          userId={account.userId}
          email={account.email}
          role={account.role}
          name={account.fullName ?? account.email}
          isSelf={account.isSelf}
        />
        <AccountDecision
          userId={account.userId}
          status={account.status}
          name={account.fullName ?? account.email}
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
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Every new account stays inactive until approved here. Students keep
          whatever profile details they entered while they wait, so approving
          one lets them straight in with nothing lost. Promoting an approved
          faculty account to Head of Department gives them their whole
          department; the Administrator role is limited to allow-listed
          addresses and cannot be granted from this screen.
        </p>
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
