import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { SkillAxis } from "@/lib/assessments/readiness";
import { performanceLevel } from "@/lib/assessments/readiness";

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 44;
const RINGS = [25, 50, 75, 100];

function point(index: number, count: number, radiusFraction: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const r = RADIUS * (radiusFraction / 100);
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

/**
 * The five scored skill areas as a radar, with the same values immediately
 * beneath it in a real `<table>`.
 *
 * Built by hand rather than pulled from a chart library, matching
 * `roadmap/RadarChart.tsx` and `DistributionChart` — the project has drawn
 * every chart this way, and the reason is the table underneath. A canvas
 * chart shows a shape; the table states the numbers, names the performance
 * band in words, and says "Not attempted yet" where a chart can only draw a
 * point at the origin. One set of facts, two renderings, no drift.
 *
 * Personality never appears here. It has no percentage, so it has no axis.
 */
export function SkillRadar({ axes }: { axes: SkillAxis[] }) {
  const labelPoints = axes.map((_, i) => point(i, axes.length, 124));
  const anyAttempted = axes.some((a) => a.attempted);

  return (
    <Card as="section">
      <CardHeader
        title="Overall skill profile"
        description="Your most recent marked score in each of the five scored areas."
      />
      <CardBody>
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-[280px] w-[280px] shrink-0"
            aria-hidden="true"
          >
            {RINGS.map((ring) => (
              <polygon
                key={ring}
                points={axes
                  .map((_, i) => {
                    const p = point(i, axes.length, ring);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ")}
                fill="none"
                className="stroke-indigo-100"
                strokeWidth={1}
              />
            ))}

            {axes.map((_, i) => {
              const p = point(i, axes.length, 100);
              return (
                <line
                  key={i}
                  x1={CENTER}
                  y1={CENTER}
                  x2={p.x}
                  y2={p.y}
                  className="stroke-indigo-100"
                  strokeWidth={1}
                />
              );
            })}

            {anyAttempted && (
              <polygon
                points={axes
                  .map((a, i) => {
                    const p = point(i, axes.length, a.value);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ")}
                className="fill-indigo-500/20 stroke-indigo-600"
                strokeWidth={2}
              />
            )}

            {axes.map((axis, i) => {
              const p = point(i, axes.length, axis.value);
              return (
                <circle
                  key={axis.label}
                  cx={p.x}
                  cy={p.y}
                  r={axis.attempted ? 4 : 3}
                  className={
                    axis.attempted
                      ? "fill-indigo-600"
                      : "fill-white stroke-indigo-300"
                  }
                  strokeWidth={1.5}
                />
              );
            })}

            {axes.map((axis, i) => {
              const p = labelPoints[i];
              return (
                <text
                  key={axis.label}
                  x={p.x}
                  y={p.y}
                  textAnchor={
                    Math.abs(p.x - CENTER) < 12
                      ? "middle"
                      : p.x > CENTER
                        ? "start"
                        : "end"
                  }
                  dominantBaseline="middle"
                  className="fill-current text-[9px] text-ink-faint"
                >
                  {axis.label.split(" ")[0]}
                </text>
              );
            })}
          </svg>

          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Latest marked score and performance band in each scored skill area
            </caption>
            <thead>
              <tr className="border-b border-indigo-100 text-xs uppercase tracking-wide text-ink-faint">
                <th scope="col" className="py-2 pr-3 font-medium">Area</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Score</th>
                <th scope="col" className="py-2 pl-3 font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {axes.map((axis) => (
                <tr key={axis.label} className="border-b border-indigo-50">
                  <th scope="row" className="py-2.5 pr-3 font-medium text-indigo-950">
                    {axis.label}
                  </th>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-ink-muted">
                    {axis.attempted ? `${axis.value}%` : "—"}
                  </td>
                  <td className="py-2.5 pl-3 text-ink-muted">
                    {axis.attempted
                      ? performanceLevel(axis.value).label
                      : "Not attempted yet"}
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
