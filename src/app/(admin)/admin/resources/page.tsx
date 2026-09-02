import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, EmptyState, StatTile } from "@/components/ui/Card";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { ResourceForm } from "@/components/resources/ResourceForm";
import { BulkResourceForm } from "@/components/resources/BulkResourceForm";
import {
  RetireResourceButton,
  VerifyResourceButton,
} from "@/components/resources/ResourceActions";
import { getOwnAdmin } from "@/lib/queries/admin";
import { getTagCoverage, listResources } from "@/lib/queries/resources";
import { describeGap, gaps } from "@/lib/resources/coverage";
import { getLookups } from "@/lib/queries/student";

export const metadata: Metadata = { title: "Resources" };

export default async function AdminResourcesPage() {
  const admin = await getOwnAdmin();
  if (!admin) redirect("/account-blocked?reason=no-staff-record");

  const [resources, lookups, coverage] = await Promise.all([
    listResources(),
    getLookups(),
    getTagCoverage(),
  ]);

  // Tags students have chosen that nothing in the catalogue answers. The
  // roadmap panels render from these tags, so each row is somebody looking at
  // an empty panel right now — invisible from this page without saying so.
  const tagGaps = gaps(coverage);

  const unchecked = resources.filter((r) => !r.isVerified);
  const checked = resources.filter((r) => r.isVerified);
  const untagged = resources.filter(
    (r) =>
      r.interestIds.length === 0 &&
      r.goalIds.length === 0 &&
      r.domainIds.length === 0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">Resources</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Links to VTU documents, courses, and certifications. Marking one
          checked is a statement that you opened it and confirmed what it is —
          students are shown that badge and asked to rely on it, so nothing is
          verified automatically.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="In the catalogue" value={String(resources.length)} />
        <StatTile
          label="Awaiting a check"
          value={String(unchecked.length)}
          hint={unchecked.length === 0 ? "All checked" : "Shown as unchecked"}
        />
        <StatTile
          label="Untagged"
          value={String(untagged.length)}
          hint="Never recommended"
        />
      </div>

      {tagGaps.length > 0 && (
        <Card as="section">
          <CardHeader
            title="Tags nothing answers"
            description="These students picked a goal or domain the catalogue has no entry for, so their roadmap shows an empty panel. Ordered by how many people are affected."
          />
          <CardBody>
            <ul className="space-y-2">
              {tagGaps.map((row) => (
                <li
                  key={`${row.kind}-${row.id}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-indigo-100 bg-parchment-sunk px-3 py-2 text-sm text-ink-muted"
                >
                  <span className="rounded border border-indigo-200 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-indigo-800">
                    {row.kind}
                  </span>
                  <span className="leading-relaxed">{describeGap(row)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              A gap means nobody has added an entry yet — not that one ought to
              exist. Adding a resource below and tagging it clears the row.
            </p>
          </CardBody>
        </Card>
      )}

      {unchecked.length > 0 && (
        <section aria-labelledby="unchecked-heading" className="space-y-3">
          <h2 id="unchecked-heading" className="text-lg text-indigo-950">
            Waiting to be checked
          </h2>
          <ul className="space-y-3">
            {unchecked.map((resource) => (
              <li key={resource.id} className="space-y-2">
                <ResourceCard resource={resource} />
                <div className="flex flex-wrap gap-3 pl-1">
                  <VerifyResourceButton
                    resourceId={resource.id}
                    isVerified={resource.isVerified}
                  />
                  <RetireResourceButton resourceId={resource.id} isActive />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="checked-heading" className="space-y-3">
        <h2 id="checked-heading" className="text-lg text-indigo-950">
          Checked
        </h2>
        {checked.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                title="Nothing checked yet"
                description="Add a resource below, open the link, then mark it checked."
              />
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {checked.map((resource) => (
              <li key={resource.id} className="space-y-2">
                <ResourceCard resource={resource} />
                <div className="flex flex-wrap gap-3 pl-1">
                  <VerifyResourceButton
                    resourceId={resource.id}
                    isVerified={resource.isVerified}
                  />
                  <RetireResourceButton resourceId={resource.id} isActive />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card as="section">
        <CardHeader
          title="Add a resource"
          description="Paste the exact page. Nothing here is generated or guessed — every entry is a link somebody chose."
        />
        <CardBody>
          <ResourceForm
            departments={lookups.departments}
            interests={lookups.interests}
            goals={lookups.goals}
            domains={lookups.domains}
            canVerify
          />
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Add many at once"
          description="A shortcut through the typing, not through the checking — every row lands unchecked, exactly as a single add does."
        />
        <CardBody>
          <BulkResourceForm goals={lookups.goals} domains={lookups.domains} />
        </CardBody>
      </Card>
    </div>
  );
}
