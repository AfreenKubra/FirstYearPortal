/**
 * Records already-applied migrations in `schema_migrations`.
 *
 * Needed once, for a database whose migrations were pasted into the Supabase
 * SQL Editor by hand before `npm run migrate` was set up. The runner keeps its
 * own ledger, so without this it considers every file pending and tries to
 * re-create objects that already exist.
 *
 * It does not take anyone's word for it. Each migration is matched to a
 * signature object — a table, a column, a policy, an enum value, or a function
 * body — and the row is written only if that object is genuinely present in
 * the live catalog. Anything it cannot confirm is left out and reported, so
 * the runner will still attempt it.
 *
 * Safe to re-run: every insert is `on conflict do nothing`.
 *
 * Usage:
 *   node scripts/backfill-migrations.mjs --dry
 *   node scripts/backfill-migrations.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, value] = match;
        if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    } catch {
      // Absent file is fine.
    }
  }
}

/**
 * One catalog query per migration, each returning a single boolean.
 *
 * Chosen to be the thing that migration uniquely creates, so a true result
 * means that file ran — not merely that something similar exists.
 */
const SIGNATURES = [
  ["0001_init_mvp.sql", `select to_regclass('public.students') is not null`],
  [
    "0002_public_reference_read.sql",
    `select exists (select 1 from pg_policies
       where schemaname='public' and tablename='departments'
         and policyname='reference read' and 'anon' = any(roles))`,
  ],
  [
    "0003_faculty.sql",
    `select to_regclass('public.faculty_student_assignments') is not null`,
  ],
  ["0004_admin.sql", `select to_regclass('public.admins') is not null`],
  [
    "0005_staff_registration.sql",
    `select exists (select 1 from pg_policies
       where schemaname='public' and tablename='admins'
         and policyname='insert own admin row')`,
  ],
  [
    "0006_email_sync.sql",
    `select exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='handle_auth_user_email_change')`,
  ],
  [
    "0007_residence_type.sql",
    `select exists (select 1 from information_schema.columns
       where table_schema='public' and table_name='students'
         and column_name='residence_type')`,
  ],
  [
    // 0008 rewrote handle_new_auth_user so every role starts 'pending'. The
    // 0001 version set students 'active', so the absence of that branch is
    // what distinguishes them.
    "0008_approve_all_registrations.sql",
    `select exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='handle_new_auth_user'
         and p.prosrc not like '%''active''::public.account_status%')`,
  ],
  ["0009_achievements.sql", `select to_regclass('public.achievements') is not null`],
  [
    "0010_hod_role_enum.sql",
    `select exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
       where t.typname='user_role' and e.enumlabel='hod')`,
  ],
  [
    "0011_hod_scope_and_admin_allowlist.sql",
    `select to_regclass('public.admin_allowlist') is not null`,
  ],
  ["0012_multiple_roles.sql", `select to_regclass('public.user_roles') is not null`],
  ["0013_assessments.sql", `select to_regclass('public.assessments') is not null`],
  ["0014_events.sql", `select to_regclass('public.events') is not null`],
  ["0015_resources.sql", `select to_regclass('public.resources') is not null`],
  ["0016_roadmaps.sql", `select to_regclass('public.student_roadmaps') is not null`],
  ["0017_notifications.sql", `select to_regclass('public.notifications') is not null`],
];

async function main() {
  loadEnv();
  const dry = process.argv.includes("--dry");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("\nDATABASE_URL is not set in .env.local.\n");
    process.exit(1);
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

    const { rows: existing } = await client.query(
      "select filename from public.schema_migrations",
    );
    const recorded = new Set(existing.map((r) => r.filename));

    const toRecord = [];
    const notApplied = [];

    for (const [filename, sql] of SIGNATURES) {
      if (recorded.has(filename)) {
        console.log(`  already recorded  ${filename}`);
        continue;
      }

      const { rows } = await client.query(sql);
      const present = rows[0] && Object.values(rows[0])[0] === true;

      if (present) {
        toRecord.push(filename);
        console.log(`  applied           ${filename}`);
      } else {
        notApplied.push(filename);
        console.log(`  NOT applied       ${filename}`);
      }
    }

    if (dry) {
      console.log("\nDry run — nothing was written.\n");
      return;
    }

    for (const filename of toRecord) {
      await client.query(
        "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
        [filename],
      );
    }

    console.log(
      `\n${toRecord.length} recorded as already applied.\n` +
        (notApplied.length > 0
          ? `${notApplied.length} still to run:\n` +
            notApplied.map((f) => `  - ${f}`).join("\n") +
            "\n\nRun: npm run migrate\n"
          : "Nothing left to run.\n"),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
