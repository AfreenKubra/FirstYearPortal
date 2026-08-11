"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";

/**
 * Loads the Agentation annotation toolbar in development only.
 *
 * The indirection is load-bearing. A plain `import { Agentation }` in
 * `app/layout.tsx` puts the toolbar in the client-reference manifest for
 * *every* route, because the layout is a Server Component and a static import
 * of a client component is registered at build time — the
 * `process.env.NODE_ENV` check runs at render time, far too late to stop it.
 * Measured: 429 KB of third-party toolbar shipped to every student and
 * faculty page.
 *
 * Here the import is a dynamic `import()` sitting behind a guard that webpack
 * can fold at build time, so the production bundle never references the
 * package at all.
 */
export function DevToolbar() {
  const [Toolbar, setToolbar] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let cancelled = false;
    import("agentation")
      .then((mod) => {
        // Wrapped in a function: passing a component to setState directly
        // would have React call it as an updater.
        if (!cancelled) setToolbar(() => mod.Agentation as ComponentType);
      })
      .catch(() => {
        // The toolbar is a convenience. If it fails to load, the app carries
        // on without it rather than breaking the page it sits on.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return Toolbar ? <Toolbar /> : null;
}
