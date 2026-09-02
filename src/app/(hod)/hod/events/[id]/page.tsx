import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EventDetail } from "@/components/events/EventDetail";
import { getOwnStaff } from "@/lib/queries/faculty";
import { getLookups } from "@/lib/queries/student";
import { getEvent, getEventTags, getRoster } from "@/lib/queries/events";

export const metadata: Metadata = { title: "Event" };

export default async function HodEventPage({
  params,
}: {
  params: { id: string };
}) {
  const staff = await getOwnStaff();
  if (!staff) redirect("/account-blocked?reason=no-staff-record");

  const event = await getEvent(params.id);
  if (!event) notFound();

  const [roster, { departments, goals, domains }, tags] = await Promise.all([
    getRoster(event.id),
    getLookups(),
    getEventTags(event.id),
  ]);

  return (
    <EventDetail
      event={event}
      roster={roster}
      departments={departments}
      goals={goals}
      domains={domains}
      selectedGoalIds={tags.goalIds}
      selectedDomainIds={tags.domainIds}
      basePath="/hod/events"
    />
  );
}
