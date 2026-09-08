"use client";

import { useFormState } from "react-dom";
import { idleState, type ActionState } from "./form-state";

/**
 * `useFormState`, minus the undefined.
 *
 * An action that ends in `redirect()` never returns a value. Its declared
 * type still says `Promise<ActionState>` — TypeScript allows that, because
 * `redirect()` returns `never` — so nothing warns you, and every component
 * downstream is written as though `state` is always an object. Then the
 * action redirects, React hands back `undefined`, and the next render dies on
 * `state.status` with a runtime error on a page the student was using.
 *
 * That is what happened on the assessments page: `startAttempt` redirects
 * into the attempt, and `FormMessage` read `state.status` on the way past.
 *
 * Guarding at each of the ~46 call sites would mean remembering to, forever.
 * Guarding here means the type is true again: what comes out is an
 * `ActionState`, always, and a redirecting action simply leaves it idle.
 */
export function useActionState(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  initial: ActionState = idleState,
): [ActionState, (formData: FormData) => void] {
  const [state, formAction] = useFormState(action, initial);
  return [state ?? initial, formAction];
}
