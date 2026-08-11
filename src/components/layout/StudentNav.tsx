"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui/Logo";

export type NavItem = {
  href: string;
  label: string;
  /** Modules from PRD 5.4–5.11 that are not built yet. */
  disabled?: boolean;
  /** Count shown alongside the label, e.g. accounts awaiting approval. */
  badge?: number;
};

/**
 * Sidebar on desktop, collapsible header on mobile (PRD section 6,
 * responsiveness). Unbuilt modules are rendered as disabled items rather than
 * hidden, so the shape of the product is visible without pretending the
 * features work — a dead link would be worse than an honest "coming soon".
 */
export function StudentNav({
  items,
  studentName,
}: {
  items: NavItem[];
  studentName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href;

        if (item.disabled) {
          return (
            <li key={item.label}>
              <span
                aria-disabled="true"
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-faint"
              >
                {item.label}
                <span className="rounded border border-indigo-100 bg-parchment-sunk px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide">
                  Soon
                </span>
              </span>
            </li>
          );
        }

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={[
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-800 text-parchment"
                  : "text-ink-muted hover:bg-indigo-50 hover:text-indigo-900",
              ].join(" ")}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={[
                    "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold tabular-nums",
                    active
                      ? "bg-parchment text-indigo-900"
                      : "bg-brass-500 text-white",
                  ].join(" ")}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                  <span className="sr-only"> awaiting action</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-indigo-100 bg-white px-4 py-3 lg:hidden">
        <Logo size="sm" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="student-nav"
          className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-900"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <nav
          id="student-nav"
          aria-label="Student sections"
          className="border-b border-indigo-100 bg-white px-4 py-3 lg:hidden"
        >
          {links}
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-indigo-100 bg-white lg:flex lg:flex-col">
        <div className="border-b border-indigo-100 px-5 py-4">
          <Logo />
        </div>
        <nav aria-label="Student sections" className="flex-1 px-3 py-4">
          {links}
        </nav>
        <div className="border-t border-indigo-100 px-5 py-4">
          <p className="text-xs text-ink-faint">Signed in as</p>
          <p className="truncate text-sm font-medium text-indigo-950">
            {studentName}
          </p>
        </div>
      </aside>
    </>
  );
}
