import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  ProgressBar,
  StatTile,
  Tag,
} from "@/components/ui/Card";
import { getOwnFaculty, getStudentDetail } from "@/lib/queries/faculty";
import { RESIDENCE_FIELD_LABEL, residenceLabel } from "@/config/residence";

export const metadata: Metadata = { title: "Student profile" };

const QUOTA_LABELS: Record<string, string> = {
  cet: "KCET",
  comedk: "COMEDK",
  jee: "JEE / Central counselling",
  management: "Management quota",
  diploma_lateral: "Diploma lateral entry",
  other: "Other",
};

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-faint">Not set yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </div>
  );
}

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const faculty = await getOwnFaculty();
  if (!faculty) redirect("/login");

  const detail = await getStudentDetail(params.id);

  // RLS makes an unauthorised student's row simply not exist for this caller,
  // so this covers both "no such student" and "not yours" — and deliberately
  // does not distinguish them, since the difference would itself leak whether
  // a given student exists.
  if (!detail) notFound();

  const { row, departmentName } = detail;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/faculty/students"
        className="inline-block rounded text-sm font-medium text-indigo-700 hover:underline"
      >
        ← Back to my students
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brass-600">{departmentName}</p>
          <h1 className="mt-1 text-2xl text-indigo-950 sm:text-3xl">
            {row.fullName}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {row.usn} · Semester {row.semester ?? "—"} · Section{" "}
            {row.section ?? "—"}
          </p>
        </div>
        {row.guardianVisible && (
          <span className="rounded-md border border-brass-300/60 bg-brass-50 px-2.5 py-1 text-xs font-medium text-brass-700">
            You mentor this student
          </span>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="10th"
          value={row.tenthPercentage ? `${row.tenthPercentage}%` : "—"}
        />
        <StatTile
          label="12th / PUC"
          value={row.twelfthPercentage ? `${row.twelfthPercentage}%` : "—"}
        />
        <StatTile
          label="Quota"
          value={row.quota ? QUOTA_LABELS[row.quota] ?? row.quota : "—"}
          hint={row.entranceRank != null ? `Rank ${row.entranceRank}` : undefined}
        />
        <StatTile
          label={RESIDENCE_FIELD_LABEL}
          value={residenceLabel(row.residenceType)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card as="section">
            <CardHeader
              title="Interests, goals and domains"
              description="What this student told the portal about where they want to go."
            />
            <CardBody className="space-y-5">
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink-muted">
                  Career goals
                </h3>
                <TagList items={detail.goals} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink-muted">
                  Technical domains
                </h3>
                <TagList items={detail.domains} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink-muted">
                  Areas of interest
                </h3>
                <TagList items={detail.interests} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink-muted">
                  Languages
                </h3>
                <TagList items={detail.languages} />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card as="section">
            <CardBody>
              <ProgressBar
                value={row.completionPercent}
                label="Profile completion"
              />
            </CardBody>
          </Card>

          <Card as="section">
            <CardHeader title="Contact" />
            <CardBody className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-ink-faint">Email</p>
                <p className="break-all text-ink">{row.email}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Mobile</p>
                <p className="text-ink">{row.phone}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">Home</p>
                <p className="text-ink">
                  {row.city}, {row.state}
                </p>
              </div>

              <div className="rule pt-3">
                <p className="text-xs text-ink-faint">Guardian</p>
                {row.guardianVisible ? (
                  <>
                    <p className="mt-1 text-ink">{row.guardianName}</p>
                    <p className="text-ink">{row.guardianPhone}</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-faint">
                    Hidden — visible only to this student&apos;s assigned mentor.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
