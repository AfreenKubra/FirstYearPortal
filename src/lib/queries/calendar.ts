import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CalendarEventCategory } from "@/config/calendar";
import type { CalendarEvent } from "@/lib/calendar/schedule";

/**
 * The official college calendar (migration 0026).
 *
 * `semester` narrows to rows that apply to everyone (`semester is null`) or
 * to the caller's own semester — the same "null means any" convention
 * `assessment_targets_student()` already uses for assessment audiences.
 * Passing `null` (a student whose academic profile has no semester on file
 * yet) still returns the semester-less rows, so a fresh profile isn't shown
 * an empty calendar.
 */
export async function listCalendarEvents(
  semester: number | null,
): Promise<CalendarEvent[]> {
  const supabase = createClient();

  let query = supabase
    .from("college_calendar_events")
    .select("id, title, description, category, starts_on, ends_on, semester, is_key_date")
    .order("starts_on", { ascending: true })
    .limit(500);

  query = semester === null
    ? query.is("semester", null)
    : query.or(`semester.is.null,semester.eq.${semester}`);

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as CalendarEventCategory,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    href: "/dashboard",
    isKeyDate: row.is_key_date,
  }));
}
