"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CALENDAR_CATEGORIES, CALENDAR_FILTERS, categoryMeta } from "@/config/calendar";
import type { CalendarEventCategory } from "@/config/calendar";
import {
  byCategory,
  groupByDate,
  isOngoing,
  isPast,
  upcoming,
  type CalendarEvent,
} from "@/lib/calendar/schedule";

type View = "month" | "agenda" | "upcoming";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayIso(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatRange(event: CalendarEvent): string {
  const start = new Date(`${event.startsOn}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (!event.endsOn || event.endsOn === event.startsOn) return start;
  const end = new Date(`${event.endsOn}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function EventDetail({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const meta = categoryMeta(event.category);
  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-indigo-950">{event.title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{formatRange(event)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-ink-faint hover:bg-white"
        >
          ✕
        </button>
      </div>
      <span
        className={`mt-2 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${meta.badge}`}
      >
        {meta.emoji} {meta.label}
      </span>
      {event.description && (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{event.description}</p>
      )}
    </div>
  );
}

function EventRow({
  event,
  today,
  onSelect,
}: {
  event: CalendarEvent;
  today: string;
  onSelect: () => void;
}) {
  const meta = categoryMeta(event.category);
  const past = isPast(event, today);
  const ongoing = isOngoing(event, today);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-indigo-300",
          past ? "border-indigo-50 opacity-50" : "border-indigo-100",
          ongoing && event.category === "exam" ? "border-amber-300 bg-amber-50/60" : "bg-white",
        ].join(" ")}
      >
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <span className="min-w-0 flex-1 truncate text-ink">{event.title}</span>
        <span className="shrink-0 text-xs text-ink-faint">{formatRange(event)}</span>
      </button>
    </li>
  );
}

/**
 * The official academic calendar plus the student's own events and dated
 * exams, in one place — a real month grid, an agenda, and an upcoming list,
 * not a third-party calendar library (same no-new-dependency approach as
 * `DistributionChart`). Every marked day is one row's own field; nothing
 * here computes or guesses a date.
 *
 * Students cannot edit any of this — there is no write path in this
 * component, matching `college_calendar_events`' admin-only RLS policy.
 */
export function MonthCalendar({
  title,
  events,
}: {
  title: string;
  events: CalendarEvent[];
}) {
  const today = todayIso();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [filter, setFilter] = useState<readonly CalendarEventCategory[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const filtered = useMemo(() => byCategory(events, filter), [events, filter]);
  const byDate = useMemo(() => groupByDate(filtered), [filtered]);
  const selectedEvent = filtered.find((e) => e.id === selectedEventId) ?? null;

  const selectEvent = (id: string) => {
    setSelectedEventId(id === selectedEventId ? null : id);
  };

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells: Array<{ day: number; date: string } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      date: isoDate(cursor.year, cursor.month, i + 1),
    })),
  ];
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedDayEvents = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  const goToToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(today);
  };

  return (
    <Card as="section">
      <CardHeader title={title} />
      <CardBody>
        {/* View switch */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["month", "agenda", "upcoming"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                view === v
                  ? "bg-indigo-800 text-white"
                  : "border border-indigo-100 text-ink-muted hover:border-indigo-300",
              ].join(" ")}
            >
              {v === "upcoming" ? "Upcoming Events" : v}
            </button>
          ))}
        </div>

        {/* Filters */}
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

        {view === "month" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setCursor((c) =>
                    c.month === 0
                      ? { year: c.year - 1, month: 11 }
                      : { year: c.year, month: c.month - 1 },
                  )
                }
                aria-label="Previous month"
                className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-indigo-50"
              >
                ‹
              </button>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-indigo-950">{monthLabel}</p>
                <button
                  type="button"
                  onClick={goToToday}
                  className="rounded-md border border-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:border-indigo-300"
                >
                  Today
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCursor((c) =>
                    c.month === 11
                      ? { year: c.year + 1, month: 0 }
                      : { year: c.year, month: c.month + 1 },
                  )
                }
                aria-label="Next month"
                className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-indigo-50"
              >
                ›
              </button>
            </div>

            <table className="w-full text-center text-xs">
              <caption className="sr-only">
                Calendar for {monthLabel}. Days with events are marked.
              </caption>
              <thead>
                <tr>
                  {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
                    <th key={i} scope="col" className="pb-1 font-medium text-ink-faint">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
                  <tr key={row}>
                    {cells.slice(row * 7, row * 7 + 7).map((cell, i) => {
                      if (!cell) return <td key={i} className="p-1" />;
                      const dayEvents = byDate.get(cell.date) ?? [];
                      const isToday = cell.date === today;
                      const isSelected = cell.date === selectedDate;
                      const isPastDay = cell.date < today;

                      return (
                        <td key={i} className="p-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDate(cell.date === selectedDate ? null : cell.date)
                            }
                            aria-label={`${cell.date}${dayEvents.length > 0 ? `, ${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}` : ""}`}
                            className={[
                              "flex h-9 w-9 flex-col items-center justify-center rounded-full text-sm transition-colors",
                              isSelected
                                ? "bg-indigo-800 text-white"
                                : isToday
                                  ? "border border-brass-500 text-indigo-950"
                                  : isPastDay
                                    ? "text-ink-faint hover:bg-indigo-50"
                                    : "text-ink hover:bg-indigo-50",
                            ].join(" ")}
                          >
                            {cell.day}
                            {dayEvents.length > 0 && (
                              <span className="mt-0.5 flex gap-0.5" aria-hidden="true">
                                {Array.from(new Set(dayEvents.map((e) => e.category)))
                                  .slice(0, 3)
                                  .map((category) => (
                                    <span
                                      key={category}
                                      className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : categoryMeta(category).dot}`}
                                    />
                                  ))}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedDate && (
              <div className="mt-3 border-t border-indigo-100 pt-3">
                <p className="mb-2 text-xs font-medium text-ink-faint">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-ink-faint">Nothing on this day.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selectedDayEvents.map((e) => (
                      <EventRow key={e.id} event={e} today={today} onSelect={() => selectEvent(e.id)} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {view === "agenda" && (
          <ul className="space-y-1.5">
            {filtered.length === 0 ? (
              <p className="text-sm text-ink-faint">Nothing on the calendar.</p>
            ) : (
              [...filtered]
                .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
                .map((e) => (
                  <EventRow key={e.id} event={e} today={today} onSelect={() => selectEvent(e.id)} />
                ))
            )}
          </ul>
        )}

        {view === "upcoming" && (
          <ul className="space-y-1.5">
            {upcoming(filtered, today).length === 0 ? (
              <p className="text-sm text-ink-faint">Nothing upcoming.</p>
            ) : (
              upcoming(filtered, today).map((e) => (
                <EventRow key={e.id} event={e} today={today} onSelect={() => selectEvent(e.id)} />
              ))
            )}
          </ul>
        )}

        {selectedEvent && (
          <EventDetail event={selectedEvent} onClose={() => setSelectedEventId(null)} />
        )}

        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-indigo-100 pt-3">
          {CALENDAR_CATEGORIES.map((c) => (
            <span key={c.value} className="flex items-center gap-1 text-[11px] text-ink-faint">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {c.emoji} {c.label}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
