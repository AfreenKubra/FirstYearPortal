/**
 * Merges the career-goal track and the technical-domain pathway
 * (`config/pathways.ts`) into one four-stage timeline.
 *
 * There is deliberately **no completion tracking here**. An earlier version
 * let a student tick items off and reported a percentage from it, which was
 * a number nobody had verified — the same problem as a cost field asserting
 * "Paid" about a page nobody priced. Where a student *is* on this timeline
 * now comes from their recorded semester, which is a fact on their academic
 * profile, and what they have actually achieved is shown separately from
 * records a third party confirmed (see the evidence panel on `/roadmap`).
 *
 * The stages themselves are guidance: what to focus on, and a real link when
 * one exists. They make no claim about the student at all.
 *
 * Pure and free of `server-only`, like `radar.ts`/`coverage.ts` beside it.
 */

import {
  careerTrackFor,
  domainPathwayFor,
  PATHWAY_STAGES,
  type PathwayItemDef,
  type PathwayStageId,
} from "@/config/pathways";
import { buildProviderLink } from "./link-providers";

/** Where a stage sits relative to the semester the student is actually in. */
export type StagePosition = "past" | "current" | "future" | "unknown";

export type PathwayItem = {
  id: string;
  label: string;
  stage: PathwayStageId;
  href: string | null;
};

export type PathwayStage = {
  id: PathwayStageId;
  label: string;
  semesters: string;
  items: PathwayItem[];
  position: StagePosition;
};

export type Pathway = {
  stages: PathwayStage[];
  currentStageId: PathwayStageId | null;
  nextBestAction: { item: PathwayItem; reason: string } | null;
};

export type SelectionOption = { id: number; name: string; isPrimary: boolean };

/**
 * Which selected goal/domain is "primary," for building the timeline.
 *
 * An explicit `is_primary` row wins. With none set — the common case for a
 * student who has only ever used the plain checkbox picker — the
 * lowest-id selection is used, so the page always has a deterministic
 * primary without forcing a picker step before anything can render. Empty
 * input (no goals/domains chosen at all) returns `null` rather than a guess.
 */
export function resolvePrimary(options: readonly SelectionOption[]): SelectionOption | null {
  if (options.length === 0) return null;
  return options.find((o) => o.isPrimary) ?? [...options].sort((a, b) => a.id - b.id)[0];
}

/**
 * The stage a semester falls in — the one genuinely factual "where am I"
 * signal available, since `student_academic_profiles.semester` is part of
 * the academic record rather than something self-asserted about progress.
 *
 * A missing semester returns `null` rather than assuming semester 1: a
 * profile with no semester on file has not told us where the student is,
 * and guessing would put a "YOU ARE HERE" marker on a stage they may have
 * finished two years ago.
 */
export function stageForSemester(semester: number | null): PathwayStageId | null {
  if (semester === null || !Number.isFinite(semester)) return null;
  // Below 1 is not a semester at all — guarded explicitly so a 0 or a
  // negative lands as "unknown" rather than sliding into the first stage.
  if (semester < 1) return null;
  if (semester <= 2) return "foundation";
  if (semester <= 4) return "core";
  if (semester <= 6) return "specialize";
  if (semester <= 8) return "career_ready";
  return null;
}

function resolveItem(def: PathwayItemDef): PathwayItem {
  const link = def.provider && def.keyword ? buildProviderLink(def.provider, def.keyword) : null;
  return {
    id: def.id,
    label: def.label,
    stage: def.stage,
    href: link?.url ?? null,
  };
}

export function buildPathway(input: {
  goalName: string;
  domainName: string;
  /** From `student_academic_profiles.semester`; null when not recorded. */
  semester: number | null;
}): Pathway {
  const track = careerTrackFor(input.goalName);
  const pathway = domainPathwayFor(input.domainName);
  const allDefs = [...(track?.items ?? []), ...(pathway?.items ?? [])];

  const currentStageId = stageForSemester(input.semester);
  const currentIndex = currentStageId
    ? PATHWAY_STAGES.findIndex((s) => s.id === currentStageId)
    : -1;

  const stages: PathwayStage[] = PATHWAY_STAGES.map((s, i) => ({
    id: s.id,
    label: s.label,
    semesters: s.semesters,
    items: allDefs.filter((d) => d.stage === s.id).map(resolveItem),
    position:
      currentIndex === -1
        ? "unknown"
        : i < currentIndex
          ? "past"
          : i === currentIndex
            ? "current"
            : "future",
  }));

  // The first item of the stage the student is actually in — a starting
  // point, not an assertion that everything before it is done. With no
  // semester on file, the very first item is the honest suggestion.
  const stageToStart =
    stages.find((s) => s.position === "current") ?? stages.find((s) => s.items.length > 0);
  const item = stageToStart?.items[0] ?? null;

  return {
    stages,
    currentStageId,
    nextBestAction: item
      ? {
          item,
          reason:
            `Recommended because you selected ${input.goalName} and ${input.domainName}` +
            (input.semester !== null ? `, and you are in semester ${input.semester}.` : "."),
        }
      : null,
  };
}
