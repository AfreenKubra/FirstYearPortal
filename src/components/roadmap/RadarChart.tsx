import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { RadarAxis } from "@/lib/roadmap/radar";

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 40;
const RINGS = [25, 50, 75, 100];

function point(index: number, count: number, radiusFraction: number) {
  // Start at the top (12 o'clock) and go clockwise, so the first axis reads
  // where a viewer's eye lands first.
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const r = RADIUS * (radiusFraction / 100);
  return {
    x: CENTER + r * Math.cos(angle),
    y: CENTER + r * Math.sin(angle),
  };
}

function polygonPoints(data: RadarAxis[]): string {
  return data
    .map((d, i) => {
      const p = point(i, data.length, d.value);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

/**
 * Five profile-and-progress numbers as a radar, paired with a real
 * `<table>` of the same values beneath it — the same "one set of facts, two
 * renderings, cannot drift" discipline `DistributionChart` documents for its
 * bar table, extended here to an SVG shape instead of an SVG-free bar.
 *
 * A student with nothing chosen yet still gets a chart: every axis at 0 is a
 * point, drawn as a dot at the centre rather than an empty area — the panel
 * never disappears or errors on an all-zero profile.
 */
export function RadarChart({ data }: { data: RadarAxis[] }) {
  const labelPoints = data.map((_, i) => point(i, data.length, 118));

  return (
    <Card as="section">
      <CardHeader
        title="Profile and progress"
        description="How much of your goals, domains, and interests you've set, alongside how far your roadmap and assessments have actually gone."
      />
      <CardBody>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-labelledby="radar-title"
            className="h-64 w-64 shrink-0"
          >
            <title id="radar-title">
              A five-axis chart of career goals, technical domains, areas of
              interest, roadmap progress, and assessment average, each as a
              percentage — the same numbers listed in the table below.
            </title>

            {/* Concentric reference rings, lightest at the centre. */}
            {RINGS.map((ring) => (
              <polygon
                key={ring}
                points={data
                  .map((_, i) => {
                    const p = point(i, data.length, ring);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="var(--radar-ring, #e0e7ff)"
                strokeWidth={1}
              />
            ))}

            {/* Spokes, one per axis. */}
            {data.map((_, i) => {
              const p = point(i, data.length, 100);
              return (
                <line
                  key={i}
                  x1={CENTER}
                  y1={CENTER}
                  x2={p.x}
                  y2={p.y}
                  stroke="var(--radar-ring, #e0e7ff)"
                  strokeWidth={1}
                />
              );
            })}

            <polygon
              points={polygonPoints(data)}
              fill="rgba(67, 56, 202, 0.18)"
              stroke="#4338ca"
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {data.map((d, i) => {
              const p = point(i, data.length, d.value);
              return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#4338ca" />;
            })}

            {data.map((d, i) => {
              const p = labelPoints[i];
              return (
                <text
                  key={i}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="#4c1d95"
                  aria-hidden="true"
                >
                  {d.axis}
                </text>
              );
            })}
          </svg>

          <table className="w-full text-sm">
            <caption className="sr-only">
              Profile and progress — the same five values shown in the chart
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Axis</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.axis} className="border-b border-indigo-50">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-muted">
                    {d.axis}
                  </th>
                  <td className="py-1.5 text-right tabular-nums text-ink">
                    {Math.round(d.value)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
