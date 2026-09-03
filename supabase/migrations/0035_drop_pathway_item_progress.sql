/**
 * Removes `pathway_item_progress` (added in 0034, one migration ago).
 *
 * That table stored self-ticked pathway items, and the career pathway
 * timeline turned them into a completion percentage. The percentage was the
 * problem: nobody verified any of it, so "50% done" meant only that a
 * student had clicked twice. It is the same failure the cost column's three
 * states exist to prevent — a confident claim the portal was never actually
 * told.
 *
 * The replacement makes no claim about the student from their own say-so.
 * Position on the timeline comes from `student_academic_profiles.semester`,
 * a fact already on the academic record, and what a student has achieved is
 * read from records somebody else confirmed: mentor-verified achievements,
 * faculty-graded attempts, faculty-entered internal marks, and attendance
 * marked at the event itself.
 *
 * The rows dropped here were self-assertions the portal no longer makes any
 * use of, so there is nothing to migrate them into.
 */

drop table if exists public.pathway_item_progress;
