-- ===========================================================================
-- 0043_calendar_cie_see.sql — CIE and SEE as calendar categories of their own.
--
-- VTU assesses a course in two parts that students plan around very
-- differently: Continuous Internal Evaluation (the IA tests, run by the
-- college through the semester) and the Semester End Examination (VTU's own
-- theory and practical exams). The calendar had one "exam" category for
-- both, so a student filtering for exams saw an IA test and a final exam as
-- the same kind of thing.
--
-- `exam` stays, for examinations that are neither — the dated competitive
-- exams the dashboard pulls from the resource catalogue for a student's
-- chosen goals.
--
-- Values only. Moving the existing rows is 0044's job: PostgreSQL will not
-- let a transaction use an enum value it has just added, and the migration
-- runner gives every file its own transaction.
-- ===========================================================================

alter type public.calendar_event_category add value if not exists 'cie' after 'exam';
alter type public.calendar_event_category add value if not exists 'see' after 'cie';
