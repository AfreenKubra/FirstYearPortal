import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only`'s default export unconditionally throws — Next.js
      // avoids that at build time via the "react-server" export condition,
      // which Vitest never sets. `ai-generate.test.ts` is the first suite to
      // import a file that pulls this in (via `provider.ts`), so alias it to
      // the package's own no-op build here rather than touch production code.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
