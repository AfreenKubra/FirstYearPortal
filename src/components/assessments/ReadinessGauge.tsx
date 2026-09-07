import type { PerformanceLevel } from "@/config/assessments";

const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONE_CLASS: Record<string, string> = {
  danger: "stroke-danger",
  warn: "stroke-brass-500",
  info: "stroke-indigo-500",
  success: "stroke-success",
};

/**
 * A circular progress dial, drawn with two SVG circles and no library.
 *
 * The number and its band label are real text in the middle of the ring, not
 * paint on the arc — so the reading survives a screen reader, a monochrome
 * printout, and a viewer who cannot distinguish the tone colours. The arc is
 * `aria-hidden` for the same reason: it repeats what the text already says.
 *
 * `percentage === null` is a distinct state, not zero. An empty ring with
 * "Not attempted yet" is the honest rendering for a student who has sat
 * nothing; a full-circle 0% would tell them they failed something.
 */
export function ReadinessGauge({
  percentage,
  level,
  caption,
  size = SIZE,
}: {
  percentage: number | null;
  level: PerformanceLevel | null;
  caption?: string;
  size?: number;
}) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = percentage === null ? 0 : (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-hidden="true"
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-indigo-100"
          />
          {percentage !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
              className={TONE_CLASS[level?.tone ?? "info"] ?? "stroke-indigo-500"}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {percentage === null ? (
            <span className="px-3 text-xs leading-tight text-ink-faint">
              Not attempted yet
            </span>
          ) : (
            <>
              <span className="text-2xl font-semibold tabular-nums text-indigo-950">
                {percentage}%
              </span>
              {level && (
                <span className="text-[11px] font-medium text-ink-muted">
                  {level.label}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {caption && <p className="text-xs text-ink-faint">{caption}</p>}
    </div>
  );
}

export { CIRCUMFERENCE, RADIUS };
