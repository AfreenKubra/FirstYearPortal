"use client";

import { markAllRead, markRead } from "@/lib/actions/notifications";
import { idleState } from "@/lib/actions/form-state";
import { useActionState } from "@/lib/actions/use-action-state";
import { Button } from "@/components/ui/Button";

/**
 * Read-state controls.
 *
 * Split out of the list so the list itself can stay focused on rendering —
 * and because each needs its own `useActionState`, which a server component
 * cannot hold.
 */
export function MarkAllReadButton() {
  const [, formAction] = useActionState(markAllRead, idleState);

  return (
    <form action={formAction}>
      <Button type="submit" variant="secondary" size="sm">
        Mark all read
      </Button>
    </form>
  );
}

export function MarkReadButton({
  notificationId,
  title,
}: {
  notificationId: string;
  title: string;
}) {
  const [, formAction] = useActionState(markRead, idleState);

  return (
    <form action={formAction}>
      <input type="hidden" name="notificationId" value={notificationId} />
      <Button type="submit" variant="ghost" size="sm">
        Mark read
        <span className="sr-only"> — {title}</span>
      </Button>
    </form>
  );
}
