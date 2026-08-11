import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

export function Card({ children, className, as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={[
        "rounded-card border border-indigo-100 bg-white shadow-card",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
};

export function CardHeader({
  title,
  description,
  action,
  eyebrow,
}: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-indigo-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brass-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg text-indigo-950">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["px-5 py-5 sm:px-6", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

// --- ProgressBar -----------------------------------------------------------

type Milestone = {
  label: string;
  complete: boolean;
};

type ProgressBarProps = {
  value: number;
  label?: string;
  milestones?: Milestone[];
};

/**
 * The product's signature motif (ARCHITECTURE section 8): progress rendered
 * as discrete milestones on a track rather than a smooth bar, echoing the
 * 30-day / 3–6-month / 1–4-year roadmap structure the whole portal is built
 * around. Filled markers use brass — the accent reserved for earned progress.
 *
 * The numeric value is exposed via role="progressbar" and repeated as text,
 * so the information never depends on colour or position alone.
 */
export function ProgressBar({ value, label, milestones }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-muted">
          {label ?? "Progress"}
        </span>
        <span className="font-display text-2xl tabular-nums text-indigo-900">
          {clamped}
          <span className="text-base text-ink-faint">%</span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="relative h-2 w-full overflow-hidden rounded-full bg-indigo-100"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brass-500 to-brass-300 transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>

      {milestones && milestones.length > 0 && (
        <ul className="grid gap-1.5 pt-1">
          {milestones.map((milestone) => (
            <li
              key={milestone.label}
              className="flex items-center gap-2 text-sm"
            >
              <span
                aria-hidden="true"
                className={[
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[0.5rem] font-bold",
                  milestone.complete
                    ? "border-brass-500 bg-brass-500 text-white"
                    : "border-indigo-200 bg-white text-transparent",
                ].join(" ")}
              >
                ✓
              </span>
              <span
                className={
                  milestone.complete ? "text-ink-muted" : "text-ink-faint"
                }
              >
                {milestone.label}
              </span>
              <span className="sr-only">
                {milestone.complete ? "(complete)" : "(not complete)"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Misc ------------------------------------------------------------------

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-indigo-100 bg-white px-4 py-3.5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-xl text-indigo-950">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800">
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-card border border-dashed border-indigo-200 bg-parchment-sunk/60 px-5 py-8 text-center">
      <p className="font-display text-base text-indigo-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-faint">
        {description}
      </p>
    </div>
  );
}
