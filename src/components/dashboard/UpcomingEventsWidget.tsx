"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { CALENDAR_FILTERS, categoryMeta } from "@/config/calendar";
import type { CalendarEventCategory } from "@/config/calendar";
import { byCategory, daysUntil, upcoming, type CalendarEvent } from "@/lib/calendar/schedule";

function dateLabel(event: CalendarEvent): string {
  const start = new Date(`${event.startsOn}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  if (!event.endsOn || event.endsOn === event.startsOn) return start;
  const end = new Date(`${event.endsOn}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return `${start} – ${end}`;
}

function remainingLabel(event: CalendarEvent, todayIso: string): string {
  const days = daysUntil(event.startsOn, todayIso);
  if (days === 0) return "today";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}

/**
 * The next few things on the calendar — official events, the student's own
 * registered events, and dated exams, whichever come soonest. Reads the same
 * merged list `MonthCalendar` does, just capped and re-sorted here rather
 * than fetched twice.
 *
 * The same six filter chips as the calendar's own filter bar, so narrowing
 * to "just exams" reads the same way in both places rather than two
 * different vocabularies for the same six categories.
 */
export function UpcomingEventsWidget({
  events,
  todayIso,
}: {
  events: CalendarEvent[];
  todayIso: string;
}) {
  const [filter, setFilter] = useState<readonly CalendarEventCategory[] | null>(null);
  const next = useMemo(
    () => upcoming(byCategory(events, filter), todayIso, 5),
    [events, filter, todayIso],
  );

  return (
    <Card as="section">
      <CardHeader title="Upcoming events" />
      <CardBody>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CALENDAR_FILTERS.map((f) => {
            const active =
              (f.categories === null && filter === null) ||
              (f.categories !== null &&
                filter !== null &&
                f.categories.length === filter.length &&
                f.categories.every((c) => filter.includes(c)));
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilter(f.categories)}
                className={[
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                    : "border-indigo-100 text-ink-faint hover:border-indigo-300",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {next.length === 0 ? (
          <EmptyState
            title="Nothing coming up"
            description="Events, exams, and deadlines will appear here as they're added."
          />
        ) : (
          <ul className="space-y-2.5">
            {next.map((event) => {
              const meta = categoryMeta(event.category);
              return (
                <li key={event.id} className="flex items-start gap-2.5 text-sm">
                  <span aria-hidden="true" className="shrink-0">
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{event.title}</p>
                    <p className="text-xs text-ink-faint">
                      {dateLabel(event)} · {remainingLabel(event, todayIso)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
