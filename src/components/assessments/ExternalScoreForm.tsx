"use client";

import { useState } from "react";
import { addExternalScore } from "@/lib/actions/external-scores";
import { idleState } from "@/lib/actions/form-state";
import { useActionState } from "@/lib/actions/use-action-state";
import { Select, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SKILL_CATEGORIES } from "@/config/assessments";

/**
 * Records a score this portal cannot verify.
 *
 * Everything typed here is shown back exactly as entered, next to the
 * "Self-reported — not verified" notice — there is no grading or approval
 * step, unlike the achievement form this is modelled on.
 */
export function ExternalScoreForm({
  presetCategory,
  presetPlatform,
}: {
  /** Fixes the skill area when the form is opened from that area's card. */
  presetCategory?: string;
  presetPlatform?: string;
} = {}) {
  const [state, formAction] = useActionState(addExternalScore, idleState);
  const errors = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card as="section">
      <CardHeader
        title="Add a test result"
        description="Anything you have taken outside this portal. It is recorded as self-reported until a member of staff verifies it — no outside platform sends results here on its own."
      />
      <CardBody>
        <form action={formAction} noValidate className="space-y-4">
          <FormMessage state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Platform"
              name="platform"
              placeholder="e.g. NPTEL, Infosys Springboard"
              defaultValue={presetPlatform ?? ""}
              error={errors.platform}
            />
            <TextInput
              label="Test or course name"
              name="testName"
              placeholder="e.g. Ethical Hacking"
              error={errors.testName}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Your score or result"
              name="scoreLabel"
              placeholder="e.g. 82%, Elite, Pass"
              error={errors.scoreLabel}
            />
            <Select
              label="Closest category"
              name="category"
              placeholder="Optional"
              defaultValue={presetCategory ?? ""}
              options={SKILL_CATEGORIES.map((c) => ({
                value: c.id,
                label: c.label,
              }))}
              error={errors.category}
            />
          </div>

          {/* The numeric pair is what lets a result appear against a skill
              area as a percentage. It is optional because plenty of real
              results are not a score out of anything — "Elite", "Band 7" —
              and forcing those into a percentage would invent precision. */}
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-1 text-sm font-medium text-ink-muted">
              As a number (optional)
            </legend>
            <TextInput
              label="Score"
              name="scoreValue"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 78"
              error={errors.scoreValue}
            />
            <TextInput
              label="Out of"
              name="maxScore"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 100"
              error={errors.maxScore}
            />
            <TextInput
              label="Date taken"
              name="takenOn"
              type="date"
              max={today}
              error={errors.takenOn}
            />
          </fieldset>

          <TextInput
            label="Certificate link"
            name="certificateUrl"
            type="url"
            placeholder="Optional — https://…"
            error={errors.certificateUrl}
          />

          <div className="flex justify-end border-t border-indigo-100 pt-4">
            <SubmitButton>Add score</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/** Wraps the form in a disclosure so the score list stays the primary view. */
export function AddExternalScorePanel({
  presetCategory,
  presetPlatform,
  label = "Add a test result",
}: {
  presetCategory?: string;
  presetPlatform?: string;
  label?: string;
} = {}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          {label}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ExternalScoreForm
        presetCategory={presetCategory}
        presetPlatform={presetPlatform}
      />
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
