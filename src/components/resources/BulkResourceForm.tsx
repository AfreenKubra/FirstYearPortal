"use client";

import { useFormState } from "react-dom";
import { createResourcesBulk } from "@/lib/actions/resources";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { BULK_EXAMPLE, BULK_TEMPLATE } from "@/lib/resources/bulk";
import { RESOURCE_KINDS } from "@/config/resources";
import type { LookupOption } from "@/lib/queries/student";

/**
 * Paste-many entry for the catalogue.
 *
 * The reason this exists is arithmetic: a domain's course shelf is not worth
 * opening until it has a dozen entries, and a dozen trips through the
 * twelve-field form below it is an afternoon. Curators did the sensible thing
 * and added nothing, which is why `resources` sat empty and every roadmap panel
 * that reads from it rendered a gap.
 *
 * It is a shortcut through the typing, not through the checking. Every row
 * lands unverified exactly as a single add does — the trigger from migration
 * 0015 enforces that no matter what the action asks for — so the badge students
 * are asked to rely on still means somebody opened the link.
 *
 * The valid tag names are printed below the box rather than left to a guess.
 * The parser matches names exactly and refuses the rest: fuzzy-matching "Cyber
 * Security" onto "Cybersecurity" works right up until it matches the wrong
 * thing, and creating the missing tag would let a typo become a permanent
 * option in every student's profile.
 */
export function BulkResourceForm({
  goals,
  domains,
}: {
  goals: LookupOption[];
  domains: LookupOption[];
}) {
  const [state, formAction] = useFormState(createResourcesBulk, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <div className="space-y-1.5">
        <label
          htmlFor="bulk-resources"
          className="block text-sm font-medium text-ink-muted"
        >
          One resource per line
        </label>
        <p id="bulk-format" className="text-xs text-ink-faint">
          Columns separated by <code className="text-ink-muted">|</code>, in
          this order: <code className="text-ink-muted">{BULK_TEMPLATE}</code>.
          Leave a column blank to record nothing for it — a blank cost reads as
          &ldquo;cost not recorded&rdquo;, never as Paid. Separate several tags
          with a semicolon. Blank lines, <code>#</code> comments, and a pasted
          header row are ignored.
        </p>
        <textarea
          id="bulk-resources"
          name="bulk"
          rows={8}
          required
          spellCheck={false}
          aria-describedby="bulk-format"
          className="w-full rounded-lg border border-indigo-200 bg-white px-3.5 py-2.5 font-mono text-xs text-ink shadow-sm hover:border-indigo-300 focus:border-indigo-500"
          placeholder={BULK_EXAMPLE}
        />
      </div>

      <details className="rounded-lg border border-indigo-100 bg-parchment-sunk px-3.5 py-2.5">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted">
          Names you can use in the tag columns
        </summary>
        <div className="mt-2.5 space-y-2 text-xs leading-relaxed text-ink-faint">
          <p>
            <span className="font-medium text-ink-muted">Types:</span>{" "}
            {RESOURCE_KINDS.map((k) => k.value).join(", ")}
          </p>
          <p>
            <span className="font-medium text-ink-muted">Domains:</span>{" "}
            {domains.length === 0
              ? "none defined yet"
              : domains.map((d) => d.name).join("; ")}
          </p>
          <p>
            <span className="font-medium text-ink-muted">Goals:</span>{" "}
            {goals.length === 0
              ? "none defined yet"
              : goals.map((g) => g.name).join("; ")}
          </p>
          <p>
            A name that is not on these lists is reported with its line number
            rather than created, and the other lines still go in.
          </p>
        </div>
      </details>

      <SubmitButton>Add these resources</SubmitButton>
    </form>
  );
}
