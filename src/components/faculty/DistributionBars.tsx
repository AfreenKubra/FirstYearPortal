import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Horizontal bar distribution.
 *
 * PRD section 6 requires an accessible tabular alternative for every chart.
 * Rather than bolting a separate table alongside, this *is* a table — the
 * bars are painted onto the rows via a background gradient, so the accessible
 * representation and the visual one are the same DOM, and cannot drift apart.
 */
export function DistributionBars({
  title,
  description,
  data,
  emptyMessage = "No data yet.",
}: {
  title: string;
  description?: string;
  data: Array<{ label: string; count: number }>;
  emptyMessage?: string;
}) {
  const max = data.reduce((acc, item) => Math.max(acc, item.count), 0);
  const total = data.reduce((acc, item) => acc + item.count, 0);

  return (
    <Card as="section">
      <CardHeader title={title} description={description} />
      <CardBody>
        {data.length === 0 ? (
          <p className="text-sm text-ink-faint">{emptyMessage}</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">
              {title} — {total} students in total
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Students</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const width = max > 0 ? (item.count / max) * 100 : 0;
                const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <tr key={item.label} className="align-middle">
                    <th
                      scope="row"
                      className="w-1/2 py-1.5 pr-3 text-left font-normal text-ink-muted"
                    >
                      {item.label}
                    </th>
                    <td className="py-1.5" style={{ width: "100%" }}>
                      <span
                        aria-hidden="true"
                        className="block h-2 rounded-full bg-indigo-100"
                      >
                        <span
                          className="block h-2 rounded-full bg-indigo-700"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                    </td>
                    <td className="w-20 py-1.5 pl-3 text-right tabular-nums text-ink">
                      {item.count}
                      <span className="ml-1 text-xs text-ink-faint">
                        ({share}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}
