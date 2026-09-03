/**
 * College calendar categories — the taxonomy for holidays, exam windows,
 * meetings, and deadlines published to `college_calendar_events`.
 *
 * Colour and emoji are defined once here so the month grid, the agenda list,
 * the upcoming-events widget, and the filter chips can't drift into
 * disagreeing about what "amber" means.
 */

export const CALENDAR_CATEGORIES = [
  {
    value: "holiday",
    label: "Holiday",
    emoji: "🔴",
    dot: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-700",
  },
  {
    value: "exam",
    label: "IA / Examination",
    emoji: "🟡",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    value: "ptm",
    label: "Parent–Teacher Meeting",
    emoji: "🔵",
    dot: "bg-blue-500",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    value: "academic",
    label: "Academic / Semester Event",
    emoji: "🟢",
    dot: "bg-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    value: "deadline",
    label: "Submission Deadline",
    emoji: "🟣",
    dot: "bg-purple-500",
    badge: "border-purple-200 bg-purple-50 text-purple-700",
  },
  {
    value: "timetable",
    label: "Timetable Change",
    emoji: "⚪",
    dot: "bg-slate-400",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
  },
] as const;

export type CalendarEventCategory = (typeof CALENDAR_CATEGORIES)[number]["value"];

export const CALENDAR_CATEGORY_VALUES = CALENDAR_CATEGORIES.map(
  (c) => c.value,
) as [CalendarEventCategory, ...CalendarEventCategory[]];

const CATEGORY_BY_VALUE = new Map(CALENDAR_CATEGORIES.map((c) => [c.value, c]));

export function categoryMeta(value: CalendarEventCategory) {
  return CATEGORY_BY_VALUE.get(value) ?? CALENDAR_CATEGORIES[3];
}

/**
 * The filter bar's groups, per the six named in the spec — "Timetable
 * Change" rows show under "Academic Events" rather than getting a seventh
 * chip of their own, since a timetable swap is still an academic-day event
 * to a student deciding what to expect that week.
 */
export const CALENDAR_FILTERS = [
  { label: "All Events", categories: null },
  { label: "Exams", categories: ["exam"] },
  { label: "Holidays", categories: ["holiday"] },
  { label: "Meetings", categories: ["ptm"] },
  { label: "Deadlines", categories: ["deadline"] },
  { label: "Academic Events", categories: ["academic", "timetable"] },
] as const satisfies ReadonlyArray<{
  label: string;
  categories: readonly CalendarEventCategory[] | null;
}>;

/**
 * VTU's academic year runs roughly August to July, so a date in the first
 * half of the calendar year belongs to the academic year that started the
 * August before. Computed rather than hardcoded so the dashboard title
 * doesn't need editing every July.
 */
export function academicYearLabel(today: Date = new Date()): string {
  const year = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}–${String((year + 1) % 100).padStart(2, "0")}`;
}
