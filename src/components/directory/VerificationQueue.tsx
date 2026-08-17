import Link from "next/link";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/Card";
import { VerifyForm } from "@/components/achievements/VerifyForm";
import { EvidenceList } from "@/components/achievements/AchievementCard";
import { categoryLabel, levelLabel } from "@/config/achievements";
import type { PendingVerification } from "@/lib/queries/achievements";

/**
 * The achievement verification queue (PRD 5.4), shared by faculty and HOD.
 *
 * The query behind `pending` asks for every pending achievement in the
 * portal; RLS is what narrows it to the students this caller may review. That
 * is why one component can serve a mentor and a head of department without
 * either passing a scope — and why neither can widen it by editing a URL.
 */
export function VerificationQueue({
  intro,
  emptyDescription,
  studentBasePath,
  pending,
}: {
  intro: string;
  emptyDescription: string;
  /** Where a student's name links to for this role. */
  studentBasePath: string;
  pending: PendingVerification[];
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">
          Achievements to verify
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{intro}</p>
      </header>

      {pending.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="Nothing waiting" description={emptyDescription} />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-4">
          {pending.map((achievement) => (
            <li key={achievement.id}>
              <Card>
                <CardHeader
                  title={achievement.title}
                  description={`${categoryLabel(achievement.category)} · ${levelLabel(
                    achievement.level,
                  )} level · ${new Date(
                    achievement.achievedOn,
                  ).toLocaleDateString()}${
                    achievement.organisation ? ` · ${achievement.organisation}` : ""
                  }`}
                  eyebrow="Awaiting verification"
                  action={
                    <Link
                      href={`${studentBasePath}/${achievement.studentId}`}
                      className="rounded text-sm font-medium text-indigo-700 hover:underline"
                    >
                      {achievement.studentName}
                    </Link>
                  }
                />
                <CardBody>
                  <p className="text-xs text-ink-faint">
                    {achievement.studentUsn} · submitted{" "}
                    {new Date(achievement.createdAt).toLocaleDateString()}
                  </p>

                  {achievement.description && (
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                      {achievement.description}
                    </p>
                  )}

                  {achievement.documents.length > 0 ? (
                    <EvidenceList documents={achievement.documents} />
                  ) : (
                    <p className="mt-3 text-sm text-warning">
                      No evidence attached — verify only if you can confirm this
                      another way.
                    </p>
                  )}

                  <VerifyForm
                    achievementId={achievement.id}
                    studentName={achievement.studentName}
                  />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
