import type { TrendPoint } from "@/lib/assessments/readiness";

const WIDTH = 460;
const HEIGHT = 180;
const PAD_LEFT = 34;
const PAD_BOTTOM = 26;
const PAD_TOP = 12;
const PAD_RIGHT = 12;

/**
 * Score against attempt number, as a line.
 *
 * The x-axis is the attempt *number*, not the date. Two attempts a term apart
 * and two an hour apart are the same distance here, because what the chart is
 * about is "did retaking it help", and spacing by date would turn a gap in
 * the calendar into a visual claim about progress.
 *
 * A single attempt draws a dot and no line — one point is not a trend, and
 * a line to nowhere would suggest a direction the data does not support.
 */
export function ProgressLineChart({
  trend,
  label,
}: {
  trend: TrendPoint[];
  label: string;
}) {
  if (trend.length === 0) return null;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) =>
    PAD_LEFT +
    (trend.length === 1 ? plotWidth / 2 : (plotWidth * i) / (trend.length - 1));
  const y = (percentage: number) =>
    PAD_TOP + plotHeight - (plotHeight * percentage) / 100;

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`${label}: ${trend
          .map((p) => `attempt ${p.attemptNumber}, ${p.percentage} percent`)
          .join("; ")}`}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              y1={y(tick)}
              x2={WIDTH - PAD_RIGHT}
              y2={y(tick)}
              className="stroke-indigo-100"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-current text-[9px] text-ink-faint"
            >
              {tick}
            </text>
          </g>
        ))}

        {trend.length > 1 && (
          <polyline
            points={trend.map((p, i) => `${x(i)},${y(p.percentage)}`).join(" ")}
            fill="none"
            className="stroke-indigo-600"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {trend.map((p, i) => (
          <g key={p.attemptNumber}>
            <circle cx={x(i)} cy={y(p.percentage)} r={4} className="fill-indigo-600" />
            <text
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-current text-[9px] text-ink-faint"
            >
              Attempt {p.attemptNumber}
            </text>
          </g>
        ))}
      </svg>

      {/* The same numbers as text, for anyone the shape does not reach. */}
      <figcaption className="sr-only">
        {trend
          .map((p) => `Attempt ${p.attemptNumber}: ${p.percentage}%`)
          .join(", ")}
      </figcaption>
    </figure>
  );
}
