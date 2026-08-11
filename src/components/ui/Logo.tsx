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
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  return (
    <span className="flex items-center gap-2.5">
      {branding.institution.logoUrl ? (
        /* logoUrl is an arbitrary config value, possibly external; next/image
           would need its domain registered in next.config.mjs to render it. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.institution.logoUrl}
          alt={`${branding.institution.name} logo`}
          className={`${box} shrink-0 object-contain rounded-lg`}
        />
      ) : (
        <span
          aria-label={`${branding.institution.name} logo`}
          className={`grid ${box} shrink-0 place-items-center rounded-lg bg-indigo-950 p-1 ring-1 ring-inset ring-brass-500/40 shadow-sm`}
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            aria-hidden="true"
          >
            {/* Outer Academic Shield Crest */}
            <path
              d="M16 2.5L4.5 6.5v9.5c0 8 5.2 13 11.5 14.8 6.3-1.8 11.5-6.8 11.5-14.8V6.5L16 2.5z"
              fill="url(#hkbk-brass-grad)"
              stroke="#D4AF37"
              strokeWidth="0.8"
            />
            {/* Inner Shield Body */}
            <path
              d="M16 4.3L6.2 7.7v8.3c0 6.8 4.4 11.1 9.8 12.7 5.4-1.6 9.8-5.9 9.8-12.7V7.7L16 4.3z"
              fill="#1E1B4B"
            />
            {/* HKBK Monogram / Book Symbol */}
            <path
              d="M16 8.5L8.5 12.5L16 16.5L23.5 12.5L16 8.5z"
              fill="#F59E0B"
            />
            <path
              d="M10.5 14.8V19c0 0 2.5 2 5.5 2s5.5-2 5.5-2v-4.2"
              stroke="#FCD34D"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Center Star Emblem */}
            <circle cx="16" cy="12.5" r="1.2" fill="#FFFFFF" />
            <defs>
              <linearGradient
                id="hkbk-brass-grad"
                x1="4.5"
                y1="2.5"
                x2="27.5"
                y2="28.8"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#F59E0B" />
                <stop offset="0.5" stopColor="#B45309" />
                <stop offset="1" stopColor="#78350F" />
              </linearGradient>
            </defs>
          </svg>
        </span>
      )}
      {showText && (
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold leading-tight text-indigo-950">
            {branding.product.name}
          </span>
          <span className="block truncate text-[0.6875rem] leading-tight text-ink-faint">
            {branding.institution.shortName} · {branding.institution.city}
          </span>
        </span>
      )}
    </span>
  );
}
