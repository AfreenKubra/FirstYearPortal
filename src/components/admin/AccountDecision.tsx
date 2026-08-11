"use client";

import { useFormState } from "react-dom";
import { decideAccount } from "@/lib/actions/admin";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage } from "@/components/ui/FormStatus";

/**
 * Decision controls for one account.
 *
 * Which buttons appear depends on where the account currently is:
 *
 *   pending    Accept | Decline
 *   active     Suspend
 *   rejected   Accept          (a declined registration can be reversed)
 *   suspended  Reactivate
 *
 * Each action is its own submit button carrying its own `decision` value,
 * rather than a dropdown plus a confirm — it keeps the destructive choice
 * visibly distinct from the routine one instead of hiding both behind a
 * neutral "Apply".
 */

type Decision = "active" | "rejected" | "suspended";

type Action = {
  decision: Decision;
  label: string;
  tone: "accept" | "danger";
};

function actionsFor(status: string): Action[] {
  switch (status) {
    case "pending":
      return [
        { decision: "active", label: "Accept", tone: "accept" },
        { decision: "rejected", label: "Decline", tone: "danger" },
      ];
    case "active":
      return [{ decision: "suspended", label: "Suspend", tone: "danger" }];
    case "rejected":
      return [{ decision: "active", label: "Accept", tone: "accept" }];
    case "suspended":
      return [{ decision: "active", label: "Reactivate", tone: "accept" }];
    default:
      return [{ decision: "active", label: "Accept", tone: "accept" }];
  }
}

const TONES: Record<Action["tone"], string> = {
  accept: "bg-success text-white hover:brightness-110",
  danger: "border border-danger/40 text-danger hover:bg-danger/5",
};

export function AccountDecision({
  userId,
  status,
  name,
}: {
  userId: string;
  status: string;
  name: string;
}) {
  const [state, formAction] = useFormState(decideAccount, idleState);
  const actions = actionsFor(status);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.decision}
            type="submit"
            name="decision"
            value={action.decision}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-[filter,background-color]",
              TONES[action.tone],
            ].join(" ")}
          >
            {action.label}
            {/* The visible label is short by design; screen readers get the
                name so the button is not just "Accept" repeated down a list. */}
            <span className="sr-only"> {name}</span>
          </button>
        ))}
      </div>

      <FormMessage state={state} />
    </form>
  );
}
