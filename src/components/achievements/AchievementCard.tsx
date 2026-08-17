"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { deleteAchievement } from "@/lib/actions/achievements";
import { idleState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormStatus";
import { AchievementForm } from "./AchievementForm";
import {
  categoryLabel,
  formatBytes,
  levelLabel,
  STATUS_COPY,
  type VerificationStatus,
} from "@/config/achievements";
import type { Achievement } from "@/lib/queries/achievements";

const STATUS_STYLES: Record<VerificationStatus, string> = {
  pending: "border-warning/30 bg-warning/5 text-warning",
  verified: "border-success/30 bg-success/5 text-success",
  rejected: "border-danger/30 bg-danger/5 text-danger",
};

export function StatusPill({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_COPY[status].label}
    </span>
  );
}

export function EvidenceList({
  documents,
}: {
  documents: Achievement["documents"];
}) {
  if (documents.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {documents.map((doc) => (
        <li key={doc.id}>
          {doc.url ? (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 hover:border-indigo-300"
            >
              {doc.fileName}
              <span className="text-ink-faint">
                ({formatBytes(doc.sizeBytes)})
              </span>
            </a>
          ) : (
            <span className="inline-flex items-center rounded-md border border-indigo-100 bg-parchment-sunk px-2.5 py-1 text-xs text-ink-faint">
              {doc.fileName} — link unavailable
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * One achievement as the owning student sees it: the facts, the verdict, and
 * the mentor's remarks when there are any.
 */
export function AchievementCard({ achievement }: { achievement: Achievement }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(deleteAchievement, idleState);

  if (editing) {
    return (
      <AchievementForm
        existing={achievement}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <li className="rounded-card border border-indigo-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-indigo-950">
              {achievement.title}
            </h3>
            <StatusPill status={achievement.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {categoryLabel(achievement.category)} ·{" "}
            {levelLabel(achievement.level)} level ·{" "}
            {new Date(achievement.achievedOn).toLocaleDateString()}
            {achievement.organisation ? ` · ${achievement.organisation}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <form action={formAction}>
            <input
              type="hidden"
              name="achievementId"
              value={achievement.id}
            />
            <button
              type="submit"
              className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/5"
            >
              Delete
              <span className="sr-only"> {achievement.title}</span>
            </button>
          </form>
        </div>
      </div>

      {achievement.description && (
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          {achievement.description}
        </p>
      )}

      <EvidenceList documents={achievement.documents} />

      <div className="mt-3 border-t border-indigo-100 pt-3">
        <p className="text-xs text-ink-faint">
          {STATUS_COPY[achievement.status].student}
          {achievement.verifiedByName && achievement.status !== "pending"
            ? ` Reviewed by ${achievement.verifiedByName}.`
            : ""}
        </p>
        {achievement.remarks && (
          <p className="mt-1.5 rounded-md bg-parchment-sunk px-3 py-2 text-sm text-ink">
            <span className="font-medium">Mentor&apos;s remarks: </span>
            {achievement.remarks}
          </p>
        )}
      </div>

      <FormMessage state={state} />
    </li>
  );
}
