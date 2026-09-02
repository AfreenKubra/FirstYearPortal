import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The RLS suite, run separately from `npm test`.
 *
 * Separate because these need a real database, `DATABASE_URL`, and a
 * service-role key. Folding them into the unit suite would mean a fresh
 * clone, CI, and every contributor without credentials seeing failures for a
 * reason that is not a defect — and the usual fix for that is marking them
 * skipped, at which point nobody runs them at all.
 *
 * They are also slow by nature: each spec creates real auth users. Keeping
 * `npm test` at roughly a second is what keeps it worth running constantly.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    // Fixtures are shared per file and keyed on a common prefix, so two files
    // running at once would clean up each other's rows mid-test.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
