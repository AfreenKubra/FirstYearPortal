import type { Metadata } from "next";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { getAuditLog } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Audit log" };

const ACTION_LABELS: Record<string, string> = {
  "account.active": "Account approved",
  "account.rejected": "Account rejected",
  "account.suspended": "Account suspended",
  "department.create": "Department created",
  "department.activate": "Department activated",
  "department.deactivate": "Department deactivated",
  "assignment.create": "Assignment created",
  "assignment.delete": "Assignment removed",
};

export default async function AdminAuditPage() {
  const entries = await getAuditLog(150);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">Audit log</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Append-only record of privileged actions. Entries are written
          server-side with a key no browser session holds, so an action cannot
          be performed without leaving a trace of itself.
        </p>
      </header>

      <Card as="section">
        <CardHeader
          title="Recent activity"
          description={`Showing the ${entries.length} most recent entries`}
        />
        <CardBody className={entries.length === 0 ? undefined : "py-0"}>
          {entries.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              description="Approvals, department changes, and assignment changes will appear here as they happen."
            />
          ) : (
            <ul className="divide-y divide-indigo-100">
              {entries.map((entry) => (
                <li key={entry.id} className="py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-indigo-950">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <time
                      dateTime={entry.createdAt}
                      className="text-xs tabular-nums text-ink-faint"
                    >
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {entry.actorEmail ?? "Unknown actor"}
                    {entry.entityType ? ` · ${entry.entityType}` : ""}
                    {entry.entityId ? ` · ${entry.entityId}` : ""}
                  </p>
                  {Object.keys(entry.metadata).length > 0 && (
                    <pre className="mt-1.5 overflow-x-auto rounded-md bg-parchment-sunk px-2.5 py-1.5 text-[0.6875rem] leading-relaxed text-ink-muted">
                      {JSON.stringify(entry.metadata)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
