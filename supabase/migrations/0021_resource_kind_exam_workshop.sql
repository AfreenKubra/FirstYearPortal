-- ===========================================================================
-- 0021_resource_kind_exam_workshop.sql — add 'exam' and 'workshop' kinds
--
-- Alone in its own file, for the same reason 0010 and 0018 were: PostgreSQL
-- will not let one transaction add an enum value and then use it in the same
-- transaction. 0022 uses both of these values on the new
-- `roadmap_milestone_links.kind` column.
--
-- These two kinds exist because the roadmap can now link to concrete exams
-- and workshops (PRD 5.10's linked-resources extension), not only the
-- syllabus/course/certification kinds 0015 anticipated.
-- ===========================================================================

alter type public.resource_kind add value if not exists 'exam';
alter type public.resource_kind add value if not exists 'workshop';
