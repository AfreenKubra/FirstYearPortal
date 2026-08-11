/**
 * Shared shape for every Server Action result.
 *
 * Deliberately NOT in a `"use server"` module: those files may only export
 * async functions, so a constant or type living beside the actions breaks the
 * build at page-data collection with a message that points at the page rather
 * than the real cause.
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors?: Record<string, string>;
};

export const idleState: ActionState = { status: "idle", message: null };

/** Flattens Zod issues to one message per field, first issue winning. */
export function fieldErrorsFrom(error: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
