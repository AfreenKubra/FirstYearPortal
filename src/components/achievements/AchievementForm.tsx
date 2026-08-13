"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createAchievement, updateAchievement } from "@/lib/actions/achievements";
import { idleState } from "@/lib/actions/form-state";
import { Select, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_LEVELS,
  EVIDENCE_ACCEPT,
} from "@/config/achievements";
import type { Achievement } from "@/lib/queries/achievements";

/**
 * Add or edit an achievement.
 *
 * Evidence is optional on purpose: a student who has the certificate to hand
 * can attach it now, and one who does not can still record the achievement
 * and add proof later, rather than being blocked from entering anything.
 */
export function AchievementForm({
  existing,
  onCancel,
}: {
  existing?: Achievement;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(existing);
  const [state, formAction] = useFormState(
    isEdit ? updateAchievement : createAchievement,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card as="section">
      <CardHeader
        title={isEdit ? "Edit achievement" : "Add an achievement"}
        description={
          isEdit
            ? "Changing the title, category, level, or date sends this back to your mentor for verification."
            : "Record anything you have achieved — your mentor will verify it."
        }
      />
      <CardBody>
        <form action={formAction} noValidate className="space-y-4">
          <FormMessage state={state} />
          {existing && (
            <input type="hidden" name="achievementId" value={existing.id} />
          )}

          <TextInput
            label="Title"
            name="title"
            defaultValue={existing?.title ?? ""}
            placeholder="e.g. Runner-up, VTU Zonal Football Tournament"
            error={errors.title}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              name="category"
              placeholder="Select a category"
              defaultValue={existing?.category ?? ""}
              options={ACHIEVEMENT_CATEGORIES.map((c) => ({
                value: c.value,
                label: c.label,
              }))}
              error={errors.category}
            />
            <Select
              label="Level"
              name="level"
              placeholder="Select a level"
              defaultValue={existing?.level ?? ""}
              options={ACHIEVEMENT_LEVELS.map((l) => ({
                value: l.value,
                label: l.label,
              }))}
              error={errors.level}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Date achieved"
              name="achievedOn"
              type="date"
              max={today}
              defaultValue={existing?.achievedOn ?? ""}
              error={errors.achievedOn}
            />
            <TextInput
              label="Organiser or issuer"
              name="organisation"
              defaultValue={existing?.organisation ?? ""}
              placeholder="Optional — e.g. NPTEL, VTU, HKBK"
              error={errors.organisation}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="achievement-description"
              className="block text-sm font-medium text-ink-muted"
            >
              Description
            </label>
            <textarea
              id="achievement-description"
              name="description"
              rows={3}
              maxLength={1000}
              defaultValue={existing?.description ?? ""}
              placeholder="Optional — what it was, and what you did."
              className="w-full rounded-lg border border-indigo-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm placeholder:text-ink-faint transition-colors hover:border-indigo-300 focus:border-indigo-500"
            />
            {errors.description && (
              <p role="alert" className="text-xs font-medium text-danger">
                {errors.description}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="achievement-evidence"
              className="block text-sm font-medium text-ink-muted"
            >
              Evidence
            </label>
            <input
              id="achievement-evidence"
              type="file"
              name="evidence"
              accept={EVIDENCE_ACCEPT}
              className="block w-full rounded-lg border border-indigo-200 bg-white text-sm text-ink shadow-sm file:mr-3 file:rounded-l-lg file:border-0 file:bg-indigo-50 file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-indigo-800 hover:file:bg-indigo-100"
            />
            <p className="text-xs text-ink-faint">
              Optional. JPEG, PNG, WebP, or PDF, up to 5&nbsp;MB. Only you, your
              mentor, and administrators can open it.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-indigo-100 pt-4">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <SubmitButton>
              {isEdit ? "Save changes" : "Add achievement"}
            </SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/** Wraps the add form in a disclosure so the list stays the primary view. */
export function AddAchievementPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Add an achievement</Button>
      </div>
    );
  }

  return <AchievementForm onCancel={() => setOpen(false)} />;
}
