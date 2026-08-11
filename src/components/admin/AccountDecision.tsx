"use client";

import { useFormState } from "react-dom";
import { decideAccount } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage } from "@/components/ui/FormStatus";

/**
 * Decision controls for one account.
 *
 * All three actions are shown on every account rather than only the ones that
 * apply right now. An admin scanning the list should be able to see the full
 * set of options and where this account currently sits without first working
 * out which buttons a given status would have hidden.
 *
 * The action matching the current status is rendered disabled — visible, so
 * the state is legible, but not clickable, so it cannot be re-applied.
 */

type Decision = "active" | "rejected" | "suspended";

const ACTIONS: Array<{
  decision: Decision;
  label: string;
  /** Status this action produces — disabled when already there. */
  resultingStatus: string;
  tone: "accept" | "danger";
}> = [
  {
    decision: "active",
    label: "Accept",
    resultingStatus: "active",
    tone: "accept",
  },
  {
    decision: "rejected",
    label: "Decline",
    resultingStatus: "rejected",
    tone: "danger",
  },
  {
    decision: "suspended",
    label: "Suspend",
    resultingStatus: "suspended",
    tone: "danger",
  },
];

const TONES: Record<"accept" | "danger", string> = {
  accept: "bg-success text-white hover:brightness-110",
  danger: "border border-danger/40 text-danger hover:bg-danger/5",
};

const DISABLED =
  "cursor-not-allowed border border-indigo-100 bg-parchment-sunk text-ink-faint";

export function AccountDecision({
  userId,
  status,
  name,
  isSelf = false,
}: {
  userId: string;
  status: string;
  name: string;
  isSelf?: boolean;
}) {
  const [state, formAction] = useFormState(decideAccount, idleState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => {
          // Blocking the admin's own row here mirrors the server action, which
          // refuses it outright — an admin who suspends themselves could lock
          // the institution out of its own portal.
          const disabled = isSelf || status === action.resultingStatus;

          return (
            <button
              key={action.decision}
              type="submit"
              name="decision"
              value={action.decision}
              disabled={disabled}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-[filter,background-color]",
                disabled ? DISABLED : TONES[action.tone],
              ].join(" ")}
            >
              {action.label}
              {/* Visible labels are short by design; screen readers get the
                  name so buttons are not just "Accept" repeated down a list. */}
              <span className="sr-only"> {name}</span>
            </button>
          );
        })}
      </div>

      {isSelf && (
        <p className="text-[0.6875rem] text-ink-faint">
          You cannot change the status of your own account.
        </p>
      )}

      <FormMessage state={state} />
    </form>
  );
}
