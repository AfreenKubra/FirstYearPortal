"use client";

import { useFormState } from "react-dom";
import { deleteExternalScore } from "@/lib/actions/external-scores";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage } from "@/components/ui/FormStatus";
import { SELF_REPORTED_NOTICE, SKILL_CATEGORIES } from "@/config/assessments";
import type { ExternalScore } from "@/lib/queries/external-scores";

function categoryLabel(id: string | null): string | null {
  if (!id) return null;
  return SKILL_CATEGORIES.find((c) => c.id === id)?.label ?? null;
}

/** One self-reported score, always shown with the not-verified notice attached. */
export function ExternalScoreCard({ score }: { score: ExternalScore }) {
  const [state, formAction] = useFormState(deleteExternalScore, idleState);
  const category = categoryLabel(score.category);

  return (
    <li className="rounded-card border border-indigo-100 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-indigo-950">
            {score.testName}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {score.platform} ·{" "}
            <span className="font-medium tabular-nums text-indigo-900">
              {score.scoreLabel}
            </span>
            {category ? ` · ${category}` : ""}
          </p>
        </div>

        <form action={formAction}>
          <input type="hidden" name="scoreId" value={score.id} />
          <button
            type="submit"
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
          >
            Delete
            <span className="sr-only"> {score.testName}</span>
          </button>
        </form>
      </div>

      {score.certificateUrl && (
        <a
          href={score.certificateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:underline"
        >
          Certificate ↗
        </a>
      )}

      <p className="mt-2 text-xs font-medium text-warning">
        {SELF_REPORTED_NOTICE}
      </p>

      <FormMessage state={state} />
    </li>
  );
}
