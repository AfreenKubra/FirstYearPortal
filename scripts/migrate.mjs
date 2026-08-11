/**
 * Migration runner.
 *
 * Applies every file in supabase/migrations in filename order, once each,
 * inside a transaction, and records what it applied in a
 * `schema_migrations` table. Re-running is a no-op — which is what makes it
 * safe to run against a database where some migrations were already pasted
 * into the SQL Editor by hand.
 *
 * Usage:
 *   npm run migrate           apply pending migrations
 *   npm run migrate -- --dry  list what would run, change nothing
 *
 * Needs DATABASE_URL in .env.local:
 *   Supabase → Project Settings → Database → Connection string → URI
 *   (use the Session pooler URI, and put your database password in it)
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const migrationsDir = join(root, "supabase", "migrations");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(join(root, file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key]) continue;
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    } catch {
      // File absent is fine — the variable may come from the real environment.
    }
  }
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes("--dry");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "\nDATABASE_URL is not set.\n\n" +
        "Add it to .env.local:\n" +
        "  Supabase → Project Settings → Database → Connection string → URI\n" +
        "  Use the Session pooler URI and substitute your database password.\n\n" +
        '  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n',
    );
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        filename    text primary key,
        applied_at  timestamptz not null default now()
      );
    `);

    const { rows } = await client.query(
      "select filename from public.schema_migrations",
    );
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`All ${files.length} migration(s) already applied.`);
      return;
    }

    console.log(`${pending.length} pending migration(s):`);
    for (const file of pending) console.log(`  - ${file}`);

    if (dryRun) {
      console.log("\nDry run — nothing was changed.");
      return;
    }

    for (const file of pending) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      process.stdout.write(`\nApplying ${file} ... `);

      try {
        // Each migration is its own transaction: a failure rolls that file
        // back completely rather than leaving the schema half-changed.
        await client.query("begin");
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (filename) values ($1)",
          [file],
        );
        await client.query("commit");
        console.log("ok");
      } catch (error) {
        await client.query("rollback");
        console.log("FAILED");
        console.error(`\n${file} was rolled back.\n`);
        console.error(error.message);
        process.exit(1);
      }
    }

    console.log("\nAll migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
