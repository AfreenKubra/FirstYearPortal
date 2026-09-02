/**
 * Schema doctor — reports which migrations the live database is missing.
 *
 * The app is written so a missing migration degrades quietly rather than
 * crashing: queries return empty results instead of throwing. That is the
 * right behaviour in production and a terrible one while setting up, because
 * "the achievements page is empty" and "the achievements table does not
 * exist" look identical from the browser. This tells them apart.
 *
 * Probes for the objects each migration creates rather than reading
 * `schema_migrations`, so it gives a true answer even when migrations were
 * pasted into the Supabase SQL Editor by hand and never recorded.
 *
 * Usage:  npm run check:schema
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\nNEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.\n",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/** True when the table exists and is reachable. */
async function tableExists(name) {
  const { error } = await db.from(name).select("*").limit(1);
  return !error;
}

/** True when the table has the named column. */
async function columnExists(table, column) {
  const { error } = await db.from(table).select(column).limit(1);
  return !error;
}

/** True when a function of that name exists in public. */
async function functionExists(name) {
  const { error } = await db.rpc(name);
  // A missing function is PGRST202; anything else means it is there.
  return !error || error.code !== "PGRST202";
}

/** True when the enum accepts the value — probed through a function call. */
async function roleEnumHasHod() {
  const { error } = await db.from("users").select("id").eq("role", "hod").limit(1);
  return !error;
}

const CHECKS = [
  {
    migration: "0001_init_mvp.sql",
    label: "core schema",
    probe: () => tableExists("students"),
  },
  {
    migration: "0003_faculty.sql",
    label: "faculty, assignments, directory view",
    probe: () => tableExists("faculty_student_assignments"),
  },
  {
    migration: "0004_admin.sql",
    label: "admin records",
    probe: () => tableExists("admins"),
  },
  {
    migration: "0007_residence_type.sql",
    label: "residence_type column",
    probe: () => columnExists("student_directory", "residence_type"),
  },
  {
    migration: "0009_achievements.sql",
    label: "achievements and evidence",
    probe: () => tableExists("achievements"),
  },
  {
    migration: "0010_hod_role_enum.sql",
    label: "'hod' value on user_role",
    probe: roleEnumHasHod,
  },
  {
    migration: "0011_hod_scope_and_admin_allowlist.sql",
    label: "HOD scope + administrator allow-list",
    probe: () => tableExists("admin_allowlist"),
  },
  {
    migration: "0012_multiple_roles.sql",
    label: "one account, multiple roles",
    probe: () => tableExists("user_roles"),
  },
  {
    migration: "0013_assessments.sql",
    label: "assessment engine",
    probe: () => tableExists("assessments"),
  },
  {
    migration: "0014_events.sql",
    label: "events, registration, attendance",
    probe: () => tableExists("events"),
  },
  {
    migration: "0015_resources.sql",
    label: "resource catalogue and recommendations",
    probe: () => tableExists("resources"),
  },
  {
    migration: "0016_roadmaps.sql",
    label: "development roadmaps and mentor review",
    probe: () => tableExists("student_roadmaps"),
  },
  {
    migration: "0017_notifications.sql",
    label: "notifications and realtime",
    probe: () => tableExists("notifications"),
  },
  {
    migration: "0018_roadmap_auto_status.sql",
    label: "'auto' value on roadmap_status",
    probe: async () => {
      // Filtering on an enum value Postgres does not know is an error, so a
      // clean query is proof the value exists — the same trick the 'hod'
      // probe uses.
      const { error } = await db
        .from("student_roadmaps")
        .select("id")
        .eq("approval_status", "auto")
        .limit(1);
      return !error;
    },
  },
  {
    migration: "0019_vtu_scheme_and_live_roadmaps.sql",
    label: "VTU scheme and live roadmaps",
    probe: () => tableExists("vtu_subjects"),
  },
  {
    migration: "0020_trusted_server_writes.sql",
    label: "service-role exemption on the write guards",
    probe: () => functionExists("is_trusted_server"),
  },
  {
    migration: "0025_internal_marks.sql",
    label: "internal marks (IA, assignment, activity)",
    probe: () => tableExists("student_subject_marks"),
  },
  {
    migration: "0026_subject_faculty.sql",
    label: "subject teachers, and marks restricted to them",
    probe: () => tableExists("subject_faculty"),
  },
  {
    migration: "0027_marks_released_kind.sql",
    label: "'marks_released' value on notification_kind",
    probe: async () => {
      // Filtering on an enum value Postgres does not know is an error, so a
      // clean query proves the value exists — same trick as the 'hod' and
      // 'auto' probes above.
      const { error } = await db
        .from("notifications")
        .select("id")
        .eq("kind", "marks_released")
        .limit(1);
      return !error;
    },
  },
  // 0028_marks_released_notification.sql has no probe on purpose. It creates
  // only a trigger and its function, and PostgREST does not expose trigger
  // functions in its schema cache — `functionExists` returns PGRST202 for one
  // whether or not it is there, so a probe would report MISSING for an
  // applied migration. That is worse than no probe: it sends somebody to
  // re-run a migration that already ran. It is listed as unchecked below
  // instead, which is the honest answer.
];

console.log(`\nChecking ${url}\n`);

const missing = [];

for (const check of CHECKS) {
  const ok = await check.probe();
  console.log(`  ${ok ? "ok     " : "MISSING"}  ${check.migration}  — ${check.label}`);
  if (!ok) missing.push(check.migration);
}

/**
 * Every migration file that has no probe above.
 *
 * This exists because the failure it catches has already happened twice: a
 * migration was added, no probe was written for it, and this script cheerfully
 * reported "Every migration is applied" while the tables were missing. A tool
 * that silently under-reports is worse than no tool, because it is believed.
 *
 * Some files legitimately have no probe — a policy-only or data-only migration
 * creates nothing to look for. Those are listed as unchecked rather than
 * assumed present, so the gap stays visible.
 */
const migrationsDir = join(root, "supabase", "migrations");
const probed = new Set(CHECKS.map((c) => c.migration));
const unprobed = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql") && !probed.has(name))
  .sort();

if (unprobed.length > 0) {
  console.log("\nNot checked — no probe defined for these files:");
  for (const name of unprobed) console.log(`  ?        ${name}`);
  console.log(
    "\nThey may or may not be applied. Add a probe in scripts/check-schema.mjs\n" +
      "so this script can tell you.",
  );
}

if (missing.length === 0) {
  console.log(
    unprobed.length === 0
      ? "\nEvery migration is applied.\n"
      : `\nEvery migration with a probe is applied; ${unprobed.length} unchecked.\n`,
  );
  process.exit(0);
}

console.log(
  `\n${missing.length} migration(s) not applied:\n` +
    missing.map((m) => `  - supabase/migrations/${m}`).join("\n") +
    "\n\nApply them in order. Either:\n" +
    "  npm run migrate                 (needs DATABASE_URL in .env.local)\n" +
    "or paste each file into the Supabase SQL Editor, one at a time.\n\n" +
    "0010 and 0011 must be run as two separate statements — PostgreSQL will not\n" +
    "let one transaction add an enum value and then use it.\n",
);

process.exit(1);
