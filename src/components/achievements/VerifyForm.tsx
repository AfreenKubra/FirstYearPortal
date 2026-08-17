"use client";

import { useFormState } from "react-dom";
import { verifyAchievement } from "@/lib/actions/achievements";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage } from "@/components/ui/FormStatus";

/**
 * Verify or reject one achievement.
 *
 * Remarks are optional when verifying and required when rejecting — the
 * server enforces that too. A rejection with no explanation leaves the
 * student with nothing to act on, which is the one outcome worth designing
 * against.
 */
export function VerifyForm({
  achievementId,
  studentName,
}: {
  achievementId: string;
  studentName: string;
}) {
  const [state, formAction] = useFormState(verifyAchievement, idleState);

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-indigo-100 pt-4">
      <input type="hidden" name="achievementId" value={achievementId} />

      <div className="space-y-1.5">
        <label
          htmlFor={`remarks-${achievementId}`}
          className="block text-sm font-medium text-ink-muted"
        >
          Remarks
        </label>
        <textarea
          id={`remarks-${achievementId}`}
          name="remarks"
          rows={2}
          maxLength={500}
          placeholder="Optional when verifying. Required when rejecting — say what the student should fix."
          className="w-full rounded-lg border border-indigo-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm placeholder:text-ink-faint transition-colors hover:border-indigo-300 focus:border-indigo-500"
        />
        {state.fieldErrors?.remarks && (
          <p role="alert" className="text-xs font-medium text-danger">
            {state.fieldErrors.remarks}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="verified"
          className="rounded-lg bg-success px-3.5 py-1.5 text-xs font-medium text-white transition-[filter] hover:brightness-110"
        >
          Verify
          <span className="sr-only"> {studentName}&apos;s achievement</span>
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          className="rounded-lg border border-danger/40 px-3.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
        >
          Reject
          <span className="sr-only"> {studentName}&apos;s achievement</span>
        </button>
      </div>

      <FormMessage state={state} />
    </form>
  );
}
