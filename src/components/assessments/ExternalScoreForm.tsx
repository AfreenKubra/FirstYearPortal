"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { addExternalScore } from "@/lib/actions/external-scores";
import { idleState } from "@/lib/actions/form-state";
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
export function ExternalScoreForm() {
  const [state, formAction] = useFormState(addExternalScore, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <Card as="section">
      <CardHeader
        title="Add a test result"
        description="NPTEL, Infosys Springboard, or anything else you've taken outside this portal. Shown to you as self-reported — nobody here checks it."
      />
      <CardBody>
        <form action={formAction} noValidate className="space-y-4">
          <FormMessage state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Platform"
              name="platform"
              placeholder="e.g. NPTEL, Infosys Springboard"
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
              options={SKILL_CATEGORIES.map((c) => ({
                value: c.id,
                label: c.label,
              }))}
              error={errors.category}
            />
          </div>

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
export function AddExternalScorePanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Add a test result</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ExternalScoreForm />
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
