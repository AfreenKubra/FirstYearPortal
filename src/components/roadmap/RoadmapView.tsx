import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MilestoneToggle } from "./RoadmapActions";
import { HORIZONS, HORIZON_LABELS, type Horizon } from "@/lib/roadmap/generate";
import { describeSource, AI_SUGGESTED_LINK_NOTICE } from "@/config/roadmap";
import { VERIFIED_NOTICE } from "@/config/resources";
import type { Roadmap, MilestoneLink } from "@/lib/queries/roadmaps";

/**
 * A roadmap, laid out by horizon.
 *
 * Every milestone shows its rationale, because PRD 5.10 requires a student to
 * be able to see which of their own inputs produced each suggestion. A plan
 * that cannot answer "why is this here?" is one a student has no reason to
 * trust, and no basis on which to disagree.
 */
export function RoadmapView({
  roadmap,
  interactive,
}: {
  roadmap: Roadmap;
  /** True on the student's own approved plan, where progress can be recorded. */
  interactive: boolean;
}) {
  const byHorizon = (horizon: Horizon) =>
    roadmap.milestones.filter((m) => m.horizon === horizon);

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3.5 py-2.5 text-sm text-indigo-900">
        {describeSource(roadmap.generatedBy, roadmap.provider, roadmap.model)}
      </p>

      {roadmap.mentorRemarks && (
        <Card as="section">
          <CardHeader title="From your mentor" />
          <CardBody>
            <p className="text-sm leading-relaxed text-ink">
              {roadmap.mentorRemarks}
            </p>
          </CardBody>
        </Card>
      )}

      {HORIZONS.map((horizon) => {
        const milestones = byHorizon(horizon);
        if (milestones.length === 0) return null;

        return (
          <Card as="section" key={horizon}>
            <CardHeader title={HORIZON_LABELS[horizon]} />
            <CardBody>
              <ol className="space-y-4">
                {milestones.map((milestone) => (
                  <li
                    key={milestone.id}
                    className="border-b border-indigo-100 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3
                          className={[
                            "text-sm font-medium",
                            milestone.completedAt
                              ? "text-ink-faint line-through"
                              : "text-indigo-950",
                          ].join(" ")}
                        >
                          {milestone.title}
                        </h3>
                        {milestone.detail && (
                          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                            {milestone.detail}
                          </p>
                        )}
                      </div>

                      {interactive && (
                        <MilestoneToggle
                          milestoneId={milestone.id}
                          done={milestone.completedAt !== null}
                          title={milestone.title}
                        />
                      )}
                    </div>

                    <p className="mt-2 rounded-md border border-brass-300/40 bg-brass-50/60 px-2.5 py-1.5 text-xs text-brass-800">
                      <span className="font-medium">Why: </span>
                      {milestone.rationale}
                    </p>

                    {milestone.links.length > 0 && (
                      <MilestoneLinkList links={milestone.links} />
                    )}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        );
      })}

      {roadmap.inputsSummary && (
        <details className="rounded-card border border-indigo-100 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-indigo-900">
            What this plan was built from
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {roadmap.inputsSummary}
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Recorded when the plan was generated. If your profile has changed
            since, ask your mentor for a new one.
          </p>
        </details>
      )}
    </div>
  );
}

/**
 * A milestone's attached links, catalogue links first (already the order
 * `combineMilestoneLinks` in `src/lib/roadmap/links.ts` produced them in).
 *
 * Each link is tagged with where it came from — an admin-verified catalogue
 * entry, or an AI model's suggestion resolved into a real provider URL — so a
 * student never has to guess how much to trust one over the other. The
 * catalogue badge reuses `ResourceCard.tsx`'s verified visual language; the
 * AI badge is deliberately distinct, and both carry their full notice as a
 * tooltip.
 */
function MilestoneLinkList({ links }: { links: MilestoneLink[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {links.map((link) => (
        <li key={link.id} className="flex flex-wrap items-center gap-1.5 text-xs">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
          >
            {link.title}
          </a>
          <span
            title={link.linkSource === "catalogue" ? VERIFIED_NOTICE : AI_SUGGESTED_LINK_NOTICE}
            className={[
              "shrink-0 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium",
              link.linkSource === "catalogue"
                ? "border-success/30 bg-success/5 text-success"
                : "border-indigo-300/50 bg-indigo-50 text-indigo-700",
            ].join(" ")}
          >
            {link.linkSource === "catalogue" ? "From your college" : "Suggested by AI"}
          </span>
          {link.provider && <span className="text-ink-faint">{link.provider}</span>}
        </li>
      ))}
    </ul>
  );
}
