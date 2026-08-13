/**
 * Reconciles who holds the `admin` role against the approved allow-list.
 *
 * Migration 0011 does this once, as part of installing the allow-list and its
 * guard trigger. This script does the same reconciliation on demand, which is
 * useful in two situations the migration cannot cover:
 *
 *   - before 0011 has been applied, to make the allow-list real straight away
 *   - after an address is added to `public.admin_allowlist` later, to promote
 *     the account without hand-writing UPDATE statements
 *
 * It is data-only — no DDL — so it works with the service-role key alone, and
 * it is idempotent: running it twice changes nothing the second time.
 *
 * Usage:
 *   node scripts/sync-admins.mjs --dry
 *   node scripts/sync-admins.mjs
 *   node scripts/sync-admins.mjs --email a@x.edu --email b@x.edu
 *
 * The default list must stay in step with ADMIN_ALLOWLIST in
 * src/config/roles.ts and with public.admin_allowlist. This script is an
 * operational tool, not a third source of truth — it acts on what it is
 * given.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_ALLOWLIST = ["hod.aiml@hkbk.edu.in", "afreenk.aiml@hkbk.edu.in"];

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

const argv = process.argv.slice(2);
const dry = argv.includes("--dry");

const emails = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--email" && argv[i + 1]) emails.push(argv[++i].toLowerCase());
}
const allowlist = emails.length > 0 ? emails : DEFAULT_ALLOWLIST;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\nNEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.\n",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

console.log(`\nAllow-list: ${allowlist.join(", ")}\n`);

const { data: accounts, error } = await db.from("users").select("id, email, role, status");
if (error) {
  console.error(`Could not read accounts: ${error.message}`);
  process.exit(1);
}

const onList = (email) => allowlist.includes((email ?? "").toLowerCase());

const toPromote = accounts.filter((a) => onList(a.email) && (a.role !== "admin" || a.status !== "active"));
const toDemote = accounts.filter((a) => a.role === "admin" && !onList(a.email));
const alreadyRight = accounts.filter(
  (a) => onList(a.email) && a.role === "admin" && a.status === "active",
);

for (const account of alreadyRight) {
  console.log(`  ok        ${account.email} — already an active administrator`);
}

if (dry) {
  for (const a of toPromote) console.log(`  would promote  ${a.email} (${a.role}/${a.status})`);
  for (const a of toDemote) console.log(`  would demote   ${a.email}`);
  console.log("\nDry run — nothing was changed.\n");
  process.exit(0);
}

for (const account of toPromote) {
  const { error: roleError } = await db
    .from("users")
    .update({ role: "admin", status: "active" })
    .eq("id", account.id);

  if (roleError) {
    console.log(`  FAIL      ${account.email} — ${roleError.message}`);
    continue;
  }

  // The admin shell renders from an `admins` row, so an account promoted
  // without one would authenticate and then have nowhere to land.
  const { data: existing } = await db
    .from("admins")
    .select("id")
    .eq("user_id", account.id)
    .maybeSingle();

  if (!existing) {
    const { data: facultyRow } = await db
      .from("faculty")
      .select("full_name, employee_code")
      .eq("user_id", account.id)
      .maybeSingle();

    const { error: insertError } = await db.from("admins").insert({
      user_id: account.id,
      full_name: facultyRow?.full_name ?? account.email,
      // Reuse an existing employee code so one person is not recorded twice
      // under two different codes.
      employee_code: facultyRow?.employee_code ?? `ADM-${account.id.slice(0, 8)}`,
      email: account.email,
      designation: "Portal Administrator",
    });

    if (insertError) {
      console.log(`  PARTIAL   ${account.email} — role set, admins row failed: ${insertError.message}`);
      continue;
    }
  }

  console.log(`  promoted  ${account.email}`);
}

for (const account of toDemote) {
  // Suspended rather than quietly downgraded: an account administering the
  // portal without being entitled to is not a routine state, and restoring it
  // should take a deliberate decision.
  const { error: demoteError } = await db
    .from("users")
    .update({ role: "faculty", status: "suspended" })
    .eq("id", account.id);

  console.log(
    demoteError
      ? `  FAIL      ${account.email} — ${demoteError.message}`
      : `  demoted   ${account.email} — suspended, no longer an administrator`,
  );
}

if (toPromote.length === 0 && toDemote.length === 0) {
  console.log("\nNothing to change.\n");
} else {
  console.log("\nDone.\n");
}
