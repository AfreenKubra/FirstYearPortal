import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, EmptyState, StatTile } from "@/components/ui/Card";
import {
  RetireSubjectButton,
  VtuSubjectForm,
} from "@/components/vtu/VtuSubjectForm";
import { getOwnAdmin } from "@/lib/queries/admin";
import { listVtuSubjects } from "@/lib/queries/vtu";
import { getLookups } from "@/lib/queries/student";

export const metadata: Metadata = { title: "VTU scheme" };

export default async function AdminVtuPage() {
  const admin = await getOwnAdmin();
  if (!admin) redirect("/account-blocked?reason=no-staff-record");

  const [subjects, lookups] = await Promise.all([
    listVtuSubjects(),
    getLookups(),
  ]);

  const active = subjects.filter((s) => s.isActive);
  const untagged = active.filter((s) => s.domainIds.length === 0);

  // Grouped for reading: a scheme is understood department by department and
  // semester by semester, not as one flat list of subject codes.
  const grouped = new Map<string, typeof subjects>();
  for (const subject of subjects) {
    const key = `${subject.departmentCode} · Semester ${subject.semester} · ${subject.schemeYear} scheme`;
    grouped.set(key, [...(grouped.get(key) ?? []), subject]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl text-indigo-950 sm:text-3xl">VTU scheme</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Subjects entered here are cited by student roadmaps. The portal does
          not read vtu.ac.in and never invents a subject — a department with
          nothing recorded produces plans that say nothing about the syllabus,
          which is the honest output for &ldquo;nobody has told the portal what
          the scheme is&rdquo;.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Subjects recorded" value={String(active.length)} />
        <StatTile
          label="Departments covered"
          value={String(new Set(active.map((s) => s.departmentCode)).size)}
        />
        <StatTile
          label="Untagged"
          value={String(untagged.length)}
          hint="Cited, but not linked to a domain"
        />
      </div>

      {grouped.size === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing recorded yet"
              description="Add the subjects for a department and semester below, taking them from the official scheme document."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([heading, rows]) => (
            <Card as="section" key={heading}>
              <CardHeader title={heading} description={`${rows.length} subjects`} />
              <CardBody className="px-0 py-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <caption className="sr-only">{heading}</caption>
                    <thead>
                      <tr className="border-b border-indigo-100 text-left text-xs uppercase tracking-wide text-ink-faint">
                        <th scope="col" className="px-5 py-3 font-medium">Code</th>
                        <th scope="col" className="px-3 py-3 font-medium">Subject</th>
                        <th scope="col" className="px-3 py-3 font-medium">Domains</th>
                        <th scope="col" className="px-5 py-3 text-right font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100">
                      {rows.map((subject) => (
                        <tr
                          key={subject.id}
                          className={subject.isActive ? "" : "opacity-55"}
                        >
                          <td className="px-5 py-3 font-medium text-indigo-900">
                            {subject.code}
                          </td>
                          <td className="px-3 py-3 text-ink-muted">
                            {subject.name}
                            {subject.credits !== null && (
                              <span className="text-xs text-ink-faint">
                                {" "}
                                · {subject.credits} credits
                              </span>
                            )}
                            {!subject.isActive && (
                              <span className="ml-2 text-xs text-ink-faint">
                                (retired)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-ink-faint">
                            {subject.domainIds.length === 0
                              ? "none"
                              : subject.domainIds
                                  .map(
                                    (id) =>
                                      lookups.domains.find((d) => d.id === id)?.name ??
                                      `#${id}`,
                                  )
                                  .join(", ")}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <a
                              href={subject.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded text-xs font-medium text-indigo-700 hover:underline"
                            >
                              VTU page
                            </a>
                            <span className="mx-2 text-ink-faint">·</span>
                            <RetireSubjectButton
                              subjectId={subject.id}
                              isActive={subject.isActive}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card as="section">
        <CardHeader
          title="Add a subject"
          description="Take these from the official scheme document rather than memory — the URL you paste is what a student can check."
        />
        <CardBody>
          <VtuSubjectForm
            departments={lookups.departments}
            domains={lookups.domains}
          />
        </CardBody>
      </Card>
    </div>
  );
}
