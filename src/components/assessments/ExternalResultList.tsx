import { externalVerificationLabel } from "@/config/assessments";
import {
  externalPercentage,
  type ExternalCategorySummary,
} from "@/lib/assessments/readiness";

const TONE: Record<string, string> = {
  self_reported: "border-brass-300 bg-brass-50 text-brass-700",
  verified: "border-success/30 bg-success/5 text-success",
  rejected: "border-danger/30 bg-danger/5 text-danger",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Results a student recorded from outside this portal, shown against the
 * skill area they belong to.
 *
 * Two things this must never do, both of them easy to do by accident:
 *
 *   - Present a self-reported number as though the portal produced it. Every
 *     row carries its status in words, not just a colour, and the badge sits
 *     next to the number rather than at the end of the card where it can be
 *     read as a footnote.
 *   - Imply the score arrived on its own. None of these platforms report back
 *     here, so the student typed it, and saying so is the difference between
 *     a record and a claim.
 */
export function ExternalResultList({
  summary,
}: {
  summary: ExternalCategorySummary;
}) {
  if (summary.results.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {summary.results.map((result) => {
        const status = externalVerificationLabel(result.verification);
        const percentage = externalPercentage(result);
        const taken = formatDate(result.takenOn);

        return (
          <li
            key={result.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-indigo-100 px-3 py-2 text-xs"
          >
            <span className="font-medium text-indigo-950">{result.testName}</span>
            <span className="text-ink-faint">{result.platform}</span>

            <span className="font-medium tabular-nums text-indigo-900">
              {percentage !== null
                ? `${percentage}%`
                : result.scoreLabel}
            </span>

            {percentage !== null && result.scoreValue !== null && (
              <span className="text-ink-faint">
                ({result.scoreValue} of {result.maxScore})
              </span>
            )}

            {taken && <span className="text-ink-faint">{taken}</span>}

            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                TONE[result.verification] ?? TONE.self_reported
              }`}
            >
              {status?.short ?? "Unverified"}
            </span>

            {result.reviewerNote && (
              <span className="w-full text-ink-faint">
                Reviewer: {result.reviewerNote}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
