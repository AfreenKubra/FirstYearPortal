import { ButtonLink } from "@/components/ui/Button";
import { StudentFiltersPanel } from "./StudentFilters";
import { StudentTable } from "./StudentTable";
import { DirectoryCharts } from "./DirectoryCharts";
import {
  describeFilters,
  filtersToSearchParams,
  PAGE_SIZE,
  type StudentFilters,
} from "@/lib/faculty/filters";
import type { DirectoryRow } from "@/lib/queries/directory";
import type { LookupOption } from "@/lib/queries/student";

/**
 * The student directory screen, shared by faculty, HOD, and admin.
 *
 * Takes already-fetched data rather than querying: the three pages differ in
 * their copy and their base path, not in how the directory works, and keeping
 * the fetch in the page keeps each route's data requirements visible where
 * that route is defined.
 */
export function DirectoryView({
  title,
  intro,
  basePath,
  exportPath,
  emptyTitle,
  emptyDescription,
  filters,
  rows,
  allRows,
  total,
  page,
  pageCount,
  lookups,
}: {
  title: string;
  intro: string;
  basePath: string;
  exportPath: string;
  emptyTitle: string;
  emptyDescription: string;
  filters: StudentFilters;
  /** The current page of results. */
  rows: DirectoryRow[];
  /** Every row matching the filters — what the charts summarise. */
  allRows: DirectoryRow[];
  total: number;
  page: number;
  pageCount: number;
  lookups: {
    departments: Array<{ code: string; name: string }>;
    interests: LookupOption[];
    goals: LookupOption[];
    domains: LookupOption[];
  };
}) {
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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-indigo-950 sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">{intro}</p>
        </div>
        {total > 0 && (
          <ButtonLink
            href={`${exportPath}?${exportQuery}`}
            variant="secondary"
          >
            Download CSV ({total})
          </ButtonLink>
        )}
      </header>

      <StudentFiltersPanel
        basePath={basePath}
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

      <StudentTable
        rows={rows}
        filters={filters}
        total={total}
        page={page}
        pageCount={pageCount}
        basePath={basePath}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />

      {/* Charts summarise every matching student, not just this page — the
          count in the heading and the count above the table agree because
          both come from the same filtered query. */}
      <DirectoryCharts rows={allRows} />

      {total > allRows.length && (
        <p className="text-xs text-ink-faint">
          Charts and the CSV cover the first{" "}
          <span className="tabular-nums">{allRows.length}</span> of{" "}
          <span className="tabular-nums">{total}</span> matching students.
          Narrow the filters to bring the whole set into one report.
        </p>
      )}

      {total > 0 && total <= PAGE_SIZE && (
        <p className="sr-only">All matching students are shown on this page.</p>
      )}
    </div>
  );
}
