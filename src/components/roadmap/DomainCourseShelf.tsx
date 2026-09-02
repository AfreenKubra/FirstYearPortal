import { Card, CardBody, CardHeader, EmptyState, StatTile } from "@/components/ui/Card";
import { DistributionChart } from "@/components/directory/DistributionChart";
import {
  COST_UNKNOWN_NOTICE,
  UNVERIFIED_NOTICE,
  VERIFIED_NOTICE,
  costLabel,
  resourceKindLabel,
} from "@/config/resources";
import type { Resource } from "@/lib/queries/resources";

export type DomainShelf = {
  domain: string;
  resources: Resource[];
};

const COST_STYLES: Record<string, string> = {
  free: "border-success/30 bg-success/5 text-success",
  paid: "border-indigo-200 bg-indigo-50 text-indigo-800",
  unknown: "border-indigo-100 bg-parchment-sunk text-ink-faint",
};

/**
 * Every catalogue entry tagged to the domains a student chose, grouped by
 * domain, each one labelled Free / Paid / Cost not recorded.
 *
 * This is a *filter*, not a recommendation. `recommendResources` ranks, weights
 * and caps at a dozen, which is right for the recommendations page and wrong
 * here: a student who asked to see the courses for Cybersecurity wants all of
 * them, and a ranked list would silently hide the rest with no way to tell they
 * existed.
 *
 * Order is inherited from the catalogue query — verified first, then title —
 * so free never precedes paid by position. Putting the free ones first would
 * be an endorsement the portal has no basis for making; some of the paid ones
 * are the better material, and the badge says which is which.
 *
 * The cost badge has three states because the column does. An entry nobody has
 * priced reads "Cost not recorded", never "Paid" — see `costLabel`, and the
 * bug it exists to prevent.
 */
export function DomainCourseShelf({
  shelves,
  chosenDomains,
}: {
  shelves: DomainShelf[];
  /** Every domain the student picked, including ones with nothing tagged. */
  chosenDomains: string[];
}) {
  if (chosenDomains.length === 0) return null;

  // Deduplicated: an entry tagged to two of the student's domains appears on
  // both shelves but is one course, and counting it twice would inflate every
  // number under this heading.
  const unique = new Map<string, Resource>();
  for (const shelf of shelves) {
    for (const resource of shelf.resources) unique.set(resource.id, resource);
  }
  const all = Array.from(unique.values());

  const free = all.filter((r) => r.isFree === true).length;
  const paid = all.filter((r) => r.isFree === false).length;
  const unpriced = all.filter((r) => r.isFree === null).length;

  const hours = all.reduce((sum, r) => sum + (r.estimatedHours ?? 0), 0);
  const withHours = all.filter((r) => r.estimatedHours !== null).length;

  const emptyDomains = chosenDomains.filter(
    (domain) =>
      !shelves.some((s) => s.domain === domain && s.resources.length > 0),
  );

  return (
    <section aria-labelledby="domain-shelf" className="space-y-4">
      <h2 id="domain-shelf" className="text-lg text-indigo-950">
        Material for your domains
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Courses available"
          value={String(all.length)}
          hint={`across ${chosenDomains.length} domain${chosenDomains.length === 1 ? "" : "s"}`}
        />
        <StatTile label="Free" value={String(free)} />
        <StatTile
          label="Cost not recorded"
          value={String(unpriced)}
          hint={unpriced === 0 ? undefined : "Check the provider's page"}
        />
        <StatTile
          label="Effort available"
          value={hours === 0 ? "—" : `≈ ${hours} h`}
          hint={
            withHours === all.length
              ? undefined
              : `${all.length - withHours} not estimated`
          }
        />
      </div>

      {all.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionChart
            title="Courses by domain"
            description="How much material is tagged to each domain you chose."
            data={shelves.map((s) => ({
              label: s.domain,
              count: s.resources.length,
            }))}
            unit="courses"
            emptyMessage="Nothing tagged to your domains yet."
          />

          {/* Three bars, not two. The unknown bucket is drawn rather than
              folded into "Paid", because a student deciding what they can
              afford needs to see how much of this nobody has priced. */}
          <DistributionChart
            title="What this costs"
            description="Cost as recorded in the catalogue. Nothing here is inferred."
            data={[
              { label: "Free", count: free },
              { label: "Paid", count: paid },
              { label: "Cost not recorded", count: unpriced },
            ]}
            unit="courses"
            emptyMessage="Nothing tagged to your domains yet."
          />
        </div>
      )}

      {shelves
        .filter((shelf) => shelf.resources.length > 0)
        .map((shelf) => (
          <Card as="section" key={shelf.domain}>
            <CardHeader
              title={shelf.domain}
              description={`${shelf.resources.length} ${
                shelf.resources.length === 1 ? "entry" : "entries"
              } tagged to this domain. Checked entries appear first.`}
            />
            <CardBody className="px-0 py-0">
              <ul className="divide-y divide-indigo-100">
                {shelf.resources.map((resource) => {
                  const cost = costLabel(resource.isFree);

                  return (
                    <li
                      key={resource.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5 hover:bg-indigo-50/40 sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brass-600">
                          {resourceKindLabel(resource.kind)}
                          {resource.provider ? ` · ${resource.provider}` : ""}
                        </p>
                        <p className="mt-0.5 text-sm text-indigo-950">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded hover:underline"
                          >
                            {resource.title}
                          </a>
                        </p>
                        {resource.estimatedHours !== null && (
                          <p className="mt-0.5 text-xs text-ink-faint">
                            about {resource.estimatedHours} hours
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          title={
                            cost.tone === "unknown"
                              ? COST_UNKNOWN_NOTICE
                              : undefined
                          }
                          className={[
                            "rounded-md border px-2 py-1 text-xs font-medium",
                            COST_STYLES[cost.tone],
                          ].join(" ")}
                        >
                          {cost.label}
                        </span>
                        <span
                          title={
                            resource.isVerified
                              ? VERIFIED_NOTICE
                              : UNVERIFIED_NOTICE
                          }
                          className={[
                            "rounded-md border px-2 py-1 text-xs font-medium",
                            resource.isVerified
                              ? "border-success/30 bg-success/5 text-success"
                              : "border-warning/40 bg-warning/5 text-warning",
                          ].join(" ")}
                        >
                          {resource.isVerified ? "Checked" : "Not checked"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        ))}

      {/* Named, not silent. An empty shelf is a gap in curation, and saying so
          gives the student something to ask for; rendering nothing would look
          like the domain they picked simply does not matter. */}
      {emptyDomains.length > 0 && (
        <Card as="section">
          <CardBody>
            <EmptyState
              title={`Nothing tagged to ${emptyDomains.join(", ")} yet`}
              description="Your college has not added catalogue entries for these domains. They are worth asking your mentor about — the portal only shows material somebody has deliberately curated."
            />
          </CardBody>
        </Card>
      )}
    </section>
  );
}
