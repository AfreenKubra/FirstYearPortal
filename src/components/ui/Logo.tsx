import { branding } from "@/config/branding";

/**
 * Renders a monogram rather than an image. PRD section 9 lists the official
 * HKBK logo as an open question with stakeholders, so shipping a
 * plausible-looking invented crest would be worse than an honest placeholder
 * — swap in the real asset via `branding.institution.logoUrl`.
 */
export function Logo({
  size = "md",
  showText = true,
}: {
  size?: "sm" | "md";
  showText?: boolean;
}) {
  const box = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`grid ${box} shrink-0 place-items-center rounded-lg bg-indigo-900 font-display font-semibold text-brass-200 ring-1 ring-inset ring-brass-500/30`}
      >
        {branding.institution.shortName.slice(0, 2)}
      </span>
      {showText && (
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold leading-tight text-indigo-950">
            {branding.product.name}
          </span>
          <span className="block truncate text-[0.6875rem] leading-tight text-ink-faint">
            {branding.institution.shortName} ·{" "}
            {branding.institution.city}
          </span>
        </span>
      )}
    </span>
  );
}
