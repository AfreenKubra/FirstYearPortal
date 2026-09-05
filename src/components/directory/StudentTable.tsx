import Link from "next/link";
import { Card, CardBody, EmptyState } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import {
  filtersToSearchParams,
  hasActiveFilters,
  PAGE_SIZE,
  type StudentFilters,
} from "@/lib/faculty/filters";
import type { DirectoryRow } from "@/lib/queries/directory";

/** First letters of the first two words, for the avatar fallback. */
function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

const QUOTA_LABELS: Record<string, string> = {
  cet: "KCET",
  comedk: "COMEDK",
  jee: "JEE",
  management: "Management",
  diploma_lateral: "Diploma lateral",
  other: "Other",
};

/**
 * The results table and its pagination.
 *
 * A server component with no client state: every row links to that student's
 * full profile under `basePath`, so the same table serves the faculty, HOD,
 * and admin directories and each lands on its own detail route.
 */
export function StudentTable({
  rows,
  filters,
  total,
  page,
  pageCount,
  basePath,
  emptyTitle,
  emptyDescription,
}: {
  rows: DirectoryRow[];
  filters: StudentFilters;
  total: number;
  page: number;
  pageCount: number;
  basePath: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <Card>
        <CardBody className="px-0 py-0 sm:px-0">
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={
                  hasActiveFilters(filters)
                    ? "No students match these filters"
                    : emptyTitle
                }
                description={
                  hasActiveFilters(filters)
                    ? "Try widening or resetting the filters above."
                    : emptyDescription
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <caption className="sr-only">
                  Students matching the current filters, showing {from} to {to}{" "}
                  of {total}
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
                  {rows.map((student) => (
                    <tr key={student.id} className="hover:bg-indigo-50/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* The photo the student uploaded, initials where
                              there is none — the circle keeps its size either
                              way so the name column does not jog about. */}
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-indigo-100 bg-indigo-50 text-[0.625rem] font-semibold text-indigo-800">
                            {student.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- signed
                              // Supabase URL that expires hourly; next/image would
                              // cache a URL already dead by the time it served it.
                              <img
                                src={student.photoUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span aria-hidden="true">
                                {initials(student.fullName)}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <Link
                              href={`${basePath}/${student.id}`}
                              className="rounded font-medium text-indigo-900 hover:underline"
                            >
                              {student.fullName}
                            </Link>
                            <p className="text-xs text-ink-faint">{student.usn}</p>
                          </span>
                        </div>
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

      {total > 0 && (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <p className="text-ink-muted">
            Showing <span className="tabular-nums">{from}</span>–
            <span className="tabular-nums">{to}</span> of{" "}
            <span className="tabular-nums">{total}</span>
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <ButtonLink
                href={`${basePath}?${filtersToSearchParams(filters, {
                  page: page - 1,
                })}`}
                variant="secondary"
                size="sm"
              >
                Previous
              </ButtonLink>
            )}
            {page < pageCount && (
              <ButtonLink
                href={`${basePath}?${filtersToSearchParams(filters, {
                  page: page + 1,
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
    </>
  );
}
