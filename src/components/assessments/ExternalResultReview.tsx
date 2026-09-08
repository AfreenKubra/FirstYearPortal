"use client";

import { useFormState } from "react-dom";
import { setExternalScoreVerdict } from "@/lib/actions/external-scores";
import { idleState } from "@/lib/actions/form-state";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import {
  externalVerificationLabel,
  SKILL_CATEGORIES,
} from "@/config/assessments";
import type { ExternalScore } from "@/lib/queries/external-scores";

function categoryLabel(id: string | null): string {
  if (!id) return "Uncategorised";
  return SKILL_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function formatDate(iso: string | null): string {
  if (!iso) return "date not given";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * One student's outside results, and the decision on each.
 *
 * What this asks a reviewer to do is narrow on purpose: accept the claim, or
 * decline it. There is no field here for editing the student's score, because
 * a mentor correcting a number and a mentor endorsing one are different acts,
 * and only the second is what a "Faculty verified" badge is claiming to a
 * reader. The database agrees — 0040's trigger lets a reviewer write the
 * verdict columns and nothing else.
 *
 * A verified result is still a claim about a certificate on somebody else's
 * website. Verification means a person looked; it does not make this portal
 * the source of the number.
 */
function VerdictRow({ score }: { score: ExternalScore }) {
  const [state, formAction] = useFormState(setExternalScoreVerdict, idleState);
  const status = externalVerificationLabel(score.verification);

  const percentage =
    score.scoreValue !== null && score.maxScore !== null && score.maxScore > 0
      ? Math.round((score.scoreValue / score.maxScore) * 10000) / 100
      : null;

  return (
    <li className="rounded-lg border border-indigo-100 px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="font-medium text-indigo-950">{score.testName}</span>
        <span className="text-xs text-ink-faint">{score.platform}</span>
        <span className="font-medium tabular-nums text-indigo-900">
          {percentage !== null ? `${percentage}%` : score.scoreLabel}
        </span>
        {percentage !== null && (
          <span className="text-xs text-ink-faint">
            ({score.scoreValue} of {score.maxScore})
          </span>
        )}
      </div>

      <p className="mt-0.5 text-xs text-ink-faint">
        {categoryLabel(score.category)} · taken {formatDate(score.takenOn)} ·{" "}
        {status?.label ?? "Unverified"}
      </p>

      {score.certificateUrl ? (
        <a
          href={score.certificateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs font-medium text-indigo-700 hover:underline"
        >
          Open the certificate they linked ↗
        </a>
      ) : (
        <p className="mt-1 text-xs text-ink-faint">
          No certificate link — there is nothing here to check the score
          against.
        </p>
      )}

      {score.reviewerNote && (
        <p className="mt-1 text-xs text-ink-muted">
          Note on file: {score.reviewerNote}
        </p>
      )}

      <form action={formAction} className="mt-2.5 space-y-2">
        <input type="hidden" name="scoreId" value={score.id} />

        <label className="block">
          <span className="sr-only">
            Note on your decision about {score.testName}
          </span>
          <input
            type="text"
            name="reviewerNote"
            maxLength={500}
            placeholder="Optional note — the student sees this"
            className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-ink shadow-sm hover:border-indigo-300 focus:border-indigo-500"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <SubmitButton name="verification" value="verified" size="sm">
            Verify
          </SubmitButton>
          <SubmitButton
            name="verification"
            value="rejected"
            size="sm"
            variant="secondary"
          >
            Reject
          </SubmitButton>
          {score.verification !== "self_reported" && (
            <SubmitButton
              name="verification"
              value="self_reported"
              size="sm"
              variant="secondary"
            >
              Undo decision
            </SubmitButton>
          )}
        </div>

        <FormMessage state={state} />
      </form>
    </li>
  );
}

export function ExternalResultReview({ scores }: { scores: ExternalScore[] }) {
  const pending = scores.filter((s) => s.verification === "self_reported").length;

  return (
    <Card as="section">
      <CardHeader
        title="External results"
        description="Results this student recorded from platforms outside the portal. Nothing here arrived automatically — they typed it in, so verifying means checking it against the certificate they linked."
      />
      <CardBody className="space-y-3">
        {scores.length === 0 ? (
          <EmptyState
            title="Nothing recorded"
            description="This student has not entered any results from outside the portal."
          />
        ) : (
          <>
            {pending > 0 && (
              <p className="text-xs font-medium text-brass-700">
                {pending} waiting for your decision.
              </p>
            )}
            <ul className="space-y-3">
              {scores.map((score) => (
                <VerdictRow key={score.id} score={score} />
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
