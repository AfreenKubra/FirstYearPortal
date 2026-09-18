-- ===========================================================================
-- 0044_calendar_recategorise_exams.sql — move existing exam rows into the
-- categories 0043 added.
--
-- On 18 September 2026 the calendar held eight `exam` rows, and they split
-- cleanly: four "1st/2nd IA Tests" (CIE) and four "3rd/5th Semester Theory /
-- Practical Examination" (SEE). Matched on those title shapes rather than
-- moving everything, so a row that fits neither stays `exam` and an
-- administrator can place it by hand, instead of being guessed into the
-- wrong one.
--
-- The IA portion notices (`academic`) and the IA marks deadlines
-- (`deadline`) are not exam days and are deliberately left alone.
--
-- Idempotent: a second run finds no `exam` rows of either shape left.
-- ===========================================================================

update public.college_calendar_events
   set category = 'cie'
 where category = 'exam'
   and title ~* '\mIA\M';

update public.college_calendar_events
   set category = 'see'
 where category = 'exam'
   and title ~* 'semester\s+(theory|practical)\s+exam';
