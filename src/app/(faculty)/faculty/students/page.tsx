import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody, EmptyState } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { StudentFiltersPanel } from "@/components/faculty/StudentFilters";
import { getOwnFaculty, listStudents } from "@/lib/queries/faculty";
import { getLookups } from "@/lib/queries/student";
import {
  describeFilters,
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
  PAGE_SIZE,
} from "@/lib/faculty/filters";

export const metadata: Metadata = { title: "My students" };

const QUOTA_LABELS: Record<string, string> = {
  cet: "KCET",
  comedk: "COMEDK",
  jee: "JEE",
  management: "Management",
  diploma_lateral: "Diploma lateral",
  other: "Other",
};

export default async function FacultyStudentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const faculty = await getOwnFaculty();
  if (!faculty) redirect("/login");

  const filters = parseFilters(searchParams);
  const [page, lookups] = await Promise.all([
    listStudents(filters),
    getLookups(),
  ]);

  const nameFor = (kind: "interest" | "goal" | "domain", id: number) => {
    const source =
      kind === "interest"
        ? lookups.interests
        : kind === "goal"
          ? lookups.goals
          : lookups.domains;
    return source.find((o) => o.id === id)?.name ?? `#${id}`;
  };

  const applied = describeFilters(filters, nameFor);
  const exportQuery = filtersToSearchParams(filters, { page: 1 });
  const from = page.total === 0 ? 0 : (page.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page.page * PAGE_SIZE, page.total);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-indigo-950 sm:text-3xl">My students</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Only students assigned to you appear here. Guardian contact is shown
            for students you mentor.
          </p>
        </div>
        {page.total > 0 && (
          <ButtonLink
            href={`/faculty/students/export?${exportQuery}`}
            variant="secondary"
          >
            Export CSV
          </ButtonLink>
        )}
      </header>

      <StudentFiltersPanel
        departments={lookups.departments}
        interests={lookups.interests}
        goals={lookups.goals}
        domains={lookups.domains}
      />

      {applied.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-faint">Filters:</span>
          {applied.map((part) => (
            <span
              key={part}
              className="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800"
            >
              {part}
            </span>
          ))}
        </div>
      )}

      <Card>
        <CardBody className="px-0 py-0 sm:px-0">
          {page.rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={
                  hasActiveFilters(filters)
                    ? "No students match these filters"
                    : "No students assigned yet"
                }
                description={
                  hasActiveFilters(filters)
                    ? "Try widening or resetting the filters above."
                    : "Your visibility comes from assignments created by a portal administrator."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <caption className="sr-only">
                  Students assigned to you, showing {from} to {to} of{" "}
                  {page.total}
                </caption>
                <thead>
                  <tr className="border-b border-indigo-100 text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Student
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Dept
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Sem / Sec
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Quota
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      10th
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">
                      12th
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      Profile
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-100">
                  {page.rows.map((student) => (
                    <tr key={student.id} className="hover:bg-indigo-50/40">
                      <td className="px-5 py-3">
                        <Link
                          href={`/faculty/students/${student.id}`}
                          className="rounded font-medium text-indigo-900 hover:underline"
                        >
                          {student.fullName}
                        </Link>
                        <p className="text-xs text-ink-faint">{student.usn}</p>
                      </td>
                      <td className="px-3 py-3 text-ink-muted">
                        {student.departmentCode}
                      </td>
                      <td className="px-3 py-3 text-ink-muted">
                        {student.semester ?? "—"} / {student.section ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-ink-muted">
                        {student.quota
                          ? QUOTA_LABELS[student.quota] ?? student.quota
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                        {student.tenthPercentage ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                        {student.twelfthPercentage ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={[
                            "rounded-md border px-2 py-1 text-xs font-medium tabular-nums",
                            student.completionPercent === 100
                              ? "border-success/30 bg-success/5 text-success"
                              : "border-warning/30 bg-warning/5 text-warning",
                          ].join(" ")}
                        >
                          {student.completionPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {page.total > 0 && (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <p className="text-ink-muted">
            Showing <span className="tabular-nums">{from}</span>–
            <span className="tabular-nums">{to}</span> of{" "}
            <span className="tabular-nums">{page.total}</span>
          </p>
          <div className="flex gap-2">
            {page.page > 1 && (
              <ButtonLink
                href={`/faculty/students?${filtersToSearchParams(filters, {
                  page: page.page - 1,
                })}`}
                variant="secondary"
                size="sm"
              >
                Previous
              </ButtonLink>
            )}
            {page.page < page.pageCount && (
              <ButtonLink
                href={`/faculty/students?${filtersToSearchParams(filters, {
                  page: page.page + 1,
                })}`}
                variant="secondary"
                size="sm"
              >
                Next
              </ButtonLink>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
