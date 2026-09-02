/**
 * Internal marks: copy and shared shapes (migration 0025).
 *
 * The component list itself is data — `public.mark_components` — not a
 * constant here, so a college adding "IA3" does not need a deploy. What lives
 * in this file is the copy that has to travel with those rows wherever they
 * are rendered, the same reasoning as `config/assessments.ts`: enums and
 * lookups in the database, labels and disclosures here.
 */

/**
 * The one thing this feature must never claim.
 *
 * VTU's CIE formula varies by scheme and subject kind — best-of-IAs, scaling,
 * a different split for labs — so any total the portal computed would be an
 * official-looking figure nobody entered. This is the same failure mode the
 * roadmap generator's "invents nothing" rule exists to prevent, and it is
 * worse here, because a student comparing an invented CIE against the one on
 * their result sheet has no way to tell which is wrong.
 *
 * So the portal adds the components it holds, calls the result exactly that,
 * and says so wherever the number appears.
 */
export const SUM_LABEL = "Sum of recorded components";

export const SUM_DISCLAIMER =
  "This is the total of the marks recorded here, not your official CIE. " +
  "The college calculates CIE from the VTU scheme, which may weight or scale " +
  "these differently.";

/** Shown on a component a student cannot see yet. */
export const UNRELEASED_NOTICE = "Not released yet";

/**
 * Shown to staff above the grid. States the accountability position plainly
 * rather than implying a subject-teacher restriction that does not exist yet
 * (MANUAL-STEPS: no `subject_faculty` table).
 */
export const AUTHORSHIP_NOTICE =
  "Every mark records who entered it. Any member of staff who can see this " +
  "student can edit these figures.";

/** One component definition, as held in `public.mark_components`. */
export type MarkComponent = {
  code: string;
  label: string;
  maxMarks: number;
  sortOrder: number;
  isActive: boolean;
};

/** One recorded figure for one student, one subject, one component. */
export type MarkEntry = {
  componentCode: string;
  marks: number | null;
  maxMarks: number;
  remark: string | null;
  /** Null until a member of staff releases this component to students. */
  publishedAt: string | null;
};
