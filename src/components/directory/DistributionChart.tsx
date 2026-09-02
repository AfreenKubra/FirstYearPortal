import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export type Slice = { label: string; count: number };

/**
 * Horizontal bar distribution — one measure across categories.
 *
 * PRD section 6 requires an accessible tabular alternative for every chart.
 * Rather than bolting a separate table alongside, this *is* a table: the bars
 * are drawn inside the cells, so the accessible representation and the visual
 * one are the same DOM and cannot drift apart.
 *
 * Deliberately a single hue. Every bar here answers "how many", not "which
 * one" — the categories are already named in the row headers, so giving each
 * its own colour would spend the palette on identity the labels already carry,
 * and colour would become the only thing distinguishing bars for a reader who
 * cannot separate the hues. One hue, ordered by magnitude, is both the plainer
 * and the more accessible chart.
 */
export function DistributionChart({
  title,
  description,
  data,
  emptyMessage = "No data yet.",
  unit = "students",
}: {
  title: string;
  description?: string;
  data: Slice[];
  emptyMessage?: string;
  /**
   * What the counts are counting, for the caption and the screen-reader-only
   * column header. Defaults to "students" because that is what every existing
   * caller charts; the roadmap charts courses, and a caption reading "12
   * students in total" above a list of courses would be a plain falsehood
   * heard only by the readers least able to check it against the bars.
   */
  unit?: string;
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
              {title} — {total} {unit} in total
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Category</th>
                <th scope="col">
                  {unit.charAt(0).toUpperCase() + unit.slice(1)}
                </th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const width = max > 0 ? (item.count / max) * 100 : 0;
                const share =
                  total > 0 ? Math.round((item.count / total) * 100) : 0;

                return (
                  <tr key={item.label} className="align-middle">
                    <th
                      scope="row"
                      className="w-2/5 py-1.5 pr-3 text-left font-normal text-ink-muted"
                    >
                      {item.label}
                    </th>
                    <td className="py-1.5" style={{ width: "100%" }}>
                      {/* Track is a lighter step of the bar's own ramp, so the
                          filled and unfilled parts read as one scale. */}
                      <span
                        aria-hidden="true"
                        className="block h-2 rounded-full bg-indigo-50"
                      >
                        {/* Square at the baseline, 4px rounded at the data
                            end — the end that carries the value. */}
                        <span
                          className="block h-2 rounded-l-none rounded-r-[4px] bg-indigo-700"
                          style={{ width: `${Math.max(width, item.count > 0 ? 2 : 0)}%` }}
                        />
                      </span>
                    </td>
                    <td className="w-24 py-1.5 pl-3 text-right tabular-nums text-ink">
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
