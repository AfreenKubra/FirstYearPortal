import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { examWindows, type CalendarEvent } from "@/lib/calendar/schedule";

function formatRange(event: CalendarEvent): string {
  const format = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  return event.endsOn ? `${format(event.startsOn)} – ${format(event.endsOn)}` : format(event.startsOn);
}

/**
 * Multi-day examination windows only — IA tests and semester-end exams —
 * pulled out from the full calendar so a student can see what's coming
 * without scanning every holiday and timetable note first.
 */
export function UpcomingExaminationsWidget({
  events,
  todayIso,
}: {
  events: CalendarEvent[];
  todayIso: string;
}) {
  const windows = examWindows(events, todayIso);
  if (windows.length === 0) return null;

  return (
    <Card as="section">
      <CardHeader title="Upcoming examinations" />
      <CardBody>
        <ul className="space-y-2 text-sm">
          {windows.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-ink">{event.title}</span>
              <span className="tabular-nums text-ink-faint">{formatRange(event)}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
