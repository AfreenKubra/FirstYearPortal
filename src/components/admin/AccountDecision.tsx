"use client";

import { useFormState } from "react-dom";
import { decideAccount } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage } from "@/components/ui/FormStatus";

/**
 * Approve / reject / suspend controls for one account.
 *
 * Three separate submit buttons in one form, each carrying its own `decision`
 * value, rather than a dropdown plus a confirm — the destructive options stay
 * visibly distinct instead of hiding behind a neutral "Apply".
 */
export function AccountDecision({
  userId,
  status,
}: {
  userId: string;
  status: string;
}) {
  const [state, formAction] = useFormState(decideAccount, idleState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-wrap gap-2">
        {status !== "active" && (
          <button
            type="submit"
            name="decision"
            value="active"
            className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white transition-[filter] hover:brightness-110"
          >
            Approve
          </button>
        )}
        {status === "pending" && (
          <button
            type="submit"
            name="decision"
            value="rejected"
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
          >
            Reject
          </button>
        )}
        {status === "active" && (
          <button
            type="submit"
            name="decision"
            value="suspended"
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
          >
            Suspend
          </button>
        )}
      </div>

      <FormMessage state={state} />
    </form>
  );
}
