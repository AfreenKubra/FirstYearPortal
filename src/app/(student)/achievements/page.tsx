import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody, EmptyState, StatTile } from "@/components/ui/Card";
import { AddAchievementPanel } from "@/components/achievements/AchievementForm";
import { AchievementCard } from "@/components/achievements/AchievementCard";
import { getOwnStudent } from "@/lib/queries/student";
import {
  getOwnAchievements,
  summariseAchievements,
} from "@/lib/queries/achievements";

export const metadata: Metadata = { title: "My achievements" };

export default async function AchievementsPage() {
  const student = await getOwnStudent();
  if (!student) redirect("/login");

  const achievements = await getOwnAchievements(student.id);
  const summary = summariseAchievements(achievements);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">My achievements</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Record what you have achieved — sports, certifications, events,
          competitions. Your assigned mentor verifies each entry, and you can
          see their decision and remarks here.
        </p>
      </header>

      {summary.total > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          <StatTile label="Recorded" value={String(summary.total)} />
          <StatTile label="Verified" value={String(summary.verified)} />
          <StatTile
            label="Awaiting review"
            value={String(summary.pending)}
            hint={summary.pending > 0 ? "With your mentor" : undefined}
          />
          <StatTile label="Not verified" value={String(summary.rejected)} />
        </div>
      )}

      <AddAchievementPanel />

      {achievements.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing recorded yet"
              description="Add your first achievement above. Certificates, competition results, and course completions all count."
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-4">
          {achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </ul>
      )}
    </div>
  );
}
