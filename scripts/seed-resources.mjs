/**
 * Demo catalogue entries, so the roadmap's exam track and course shelf have
 * something to render before real curation happens.
 *
 * A script, not a migration, and the distinction is the point.
 * `0015_resources.sql` argues in its own header that seeding invented rows
 * would be dishonest — a plausible-looking URL nobody has opened is exactly
 * the fabricated metadata PRD 5.9 exists to prevent — and that decision
 * stands. A migration runs on every environment whether anyone wanted it to;
 * a script is opt-in demo data an operator deliberately chooses to run, and
 * it is the only way to see the feature work before an administrator has
 * curated anything real.
 *
 * Three honesty measures are built in and should not be removed:
 *
 *   1. Every row lands UNVERIFIED. The `guard_resource_verification()` trigger
 *      enforces this regardless, but nothing here even attempts it, so the
 *      student-facing badge reads "Not checked" on all of it.
 *   2. Dated rows say so in their own description. A date is the one claim on
 *      these panels a student would plan around, and a seeded date is not a
 *      fact about the world — so the entry says which dates are placeholders,
 *      in the text the student actually reads.
 *   3. Dates are computed relative to the run date, never hardcoded. A
 *      hardcoded exam date is correct for one cycle and quietly wrong forever
 *      after, which is worse than no date at all.
 *
 * The two cost-unrecorded rows are deliberate. `resources.is_free` is a
 * nullable boolean whose NULL means "nobody has priced this", and the seed
 * exercises that third state so the shelf's "Cost not recorded" badge is
 * visible in a demo rather than only in theory.
 *
 * Usage:
 *   node scripts/seed-resources.mjs           # insert or update, then tag
 *   node scripts/seed-resources.mjs --dry     # show, change nothing
 *
 * Re-running is safe: rows are matched on `url`, which carries a unique
 * constraint, and tags are inserted with duplicates ignored.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Catalogue --------------------------------------------------------------

/**
 * Offsets in days from the run date, so a demo is never stale.
 *
 * `opens`/`closes`/`exam` must stay in that order — migration 0023 adds a
 * check constraint enforcing it, and a row that violates it is rejected by
 * the database rather than silently stored.
 */
const DATED_NOTE =
  "Dates on this entry are placeholders from the demo seed, not the official " +
  "schedule. Confirm them on the provider's own page before planning around " +
  "them.";

const RESOURCES = [
  // --- Exams, for the roadmap's exam track ---------------------------------
  {
    title: "GATE — Graduate Aptitude Test in Engineering",
    url: "https://gate.iitkgp.ac.in/",
    kind: "exam",
    provider: "IIT / IISc",
    description:
      "The national entrance test for M.Tech admission and most PSU " +
      "recruitment. Papers are subject-specific; check which one matches " +
      "your branch. " + DATED_NOTE,
    isFree: false,
    estimatedHours: null,
    dates: { opens: 40, closes: 90, exam: 170 },
    goals: ["GATE / Higher studies in India"],
    domains: [],
  },
  {
    title: "GATE — Computer Science and Information Technology (CS) paper",
    url: "https://gate.iitkgp.ac.in/pre_gate_syllabi.html",
    kind: "syllabus",
    provider: "IIT / IISc",
    description:
      "The official subject list for the CS paper. Worth reading before you " +
      "buy anything — most of it is coursework you will cover anyway.",
    isFree: true,
    estimatedHours: null,
    dates: null,
    goals: ["GATE / Higher studies in India"],
    domains: [],
  },

  // --- Cybersecurity, free -------------------------------------------------
  {
    title: "Introduction to Cyber Security",
    url: "https://onlinecourses.nptel.ac.in/noc24_cs01/preview",
    kind: "course",
    provider: "NPTEL",
    description:
      "Twelve-week introduction covering threats, cryptography basics, and " +
      "network defence. Free to audit; the certificate exam is paid.",
    isFree: true,
    estimatedHours: 60,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },
  {
    title: "Ethical Hacking",
    url: "https://onlinecourses.nptel.ac.in/noc24_cs12/preview",
    kind: "course",
    provider: "NPTEL",
    description:
      "Penetration testing methodology and the tooling around it, taught " +
      "against deliberately vulnerable targets rather than live systems.",
    isFree: true,
    estimatedHours: 48,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },
  {
    title: "Cyber Security and Privacy",
    url: "https://swayam.gov.in/nd1_noc20_cs68",
    kind: "course",
    provider: "SWAYAM",
    description:
      "Government-run course covering security policy, privacy law, and the " +
      "Indian regulatory context most international material skips.",
    isFree: true,
    estimatedHours: 40,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },

  // --- Cybersecurity, paid -------------------------------------------------
  {
    title: "IBM Cybersecurity Analyst Professional Certificate",
    url: "https://www.coursera.org/professional-certificates/ibm-cybersecurity-analyst",
    kind: "certification",
    provider: "Coursera",
    description:
      "Eight-course track aimed at a first SOC analyst role. Subscription " +
      "priced; financial aid is available and is worth applying for.",
    isFree: false,
    estimatedHours: 120,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },
  {
    title: "Google Cybersecurity Professional Certificate",
    url: "https://www.coursera.org/professional-certificates/google-cybersecurity",
    kind: "certification",
    provider: "Coursera",
    description:
      "Entry-level track with no prerequisites, covering SIEM tooling, " +
      "Linux, SQL, and incident response.",
    isFree: false,
    estimatedHours: 170,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },

  // --- Cost deliberately unrecorded ----------------------------------------
  // These two exist to make the third state visible. Nobody has checked what
  // they cost, and the catalogue says exactly that rather than guessing.
  {
    title: "OWASP Top Ten",
    url: "https://owasp.org/www-project-top-ten/",
    kind: "other",
    provider: "OWASP",
    description:
      "The reference list of web application security risks. Read this " +
      "before any course — most syllabi are organised around it.",
    isFree: null,
    estimatedHours: 4,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },
  {
    title: "TryHackMe — Introduction to Cyber Security path",
    url: "https://tryhackme.com/path/outline/introtocyber",
    kind: "tool",
    provider: "TryHackMe",
    description:
      "Browser-based hands-on labs. Some rooms are open and some are behind " +
      "a subscription; nobody has recorded which parts of this path are.",
    isFree: null,
    estimatedHours: 30,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },

  // --- Workshops in the catalogue (links, not college sessions) ------------
  {
    title: "Capture-the-flag practice: picoCTF",
    url: "https://picoctf.org/",
    kind: "workshop",
    provider: "Carnegie Mellon University",
    description:
      "Beginner-level security challenges, permanently available. The " +
      "closest thing to practice that is not a live system.",
    isFree: true,
    estimatedHours: 20,
    dates: null,
    goals: [],
    domains: ["Cybersecurity"],
  },
  {
    title: "GATE preparation workshop material — previous years' papers",
    url: "https://gate.iitkgp.ac.in/old_question_papers.html",
    kind: "question_paper",
    provider: "IIT / IISc",
    description:
      "Every past paper, released officially. Sitting one under time is the " +
      "single most useful thing available for free.",
    isFree: true,
    estimatedHours: null,
    dates: null,
    goals: ["GATE / Higher studies in India"],
    domains: [],
  },
];

// --- Plumbing ---------------------------------------------------------------

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, value] = match;
        if (!process.env[key]) {
          process.env[key] = value.replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // Absent file is fine — the value may come from the real environment.
    }
  }
}

/** `YYYY-MM-DD`, `days` from today, in UTC so the arithmetic is exact. */
function isoDaysFromNow(days) {
  const ms = Date.now() + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function datesFor(entry) {
  if (!entry.dates) {
    return {
      occurs_on: null,
      registration_opens_on: null,
      registration_closes_on: null,
    };
  }
  return {
    occurs_on: isoDaysFromNow(entry.dates.exam),
    registration_opens_on: isoDaysFromNow(entry.dates.opens),
    registration_closes_on: isoDaysFromNow(entry.dates.closes),
  };
}

/**
 * Look a lookup table up by exact name.
 *
 * Deliberately exact rather than fuzzy. A near-match would tag a resource to
 * the wrong goal and the student would be told, in the portal's own voice,
 * that this was recommended for something they never picked. An unmatched
 * name is reported and the tag is skipped — a resource with one fewer tag is
 * recoverable; a resource with a wrong tag looks correct.
 */
async function lookupIds(db, table, names) {
  if (names.length === 0) return { ids: [], missing: [] };

  const { data, error } = await db.from(table).select("id, name").in("name", names);
  if (error) throw new Error(`${table}: ${error.message}`);

  const byName = new Map((data ?? []).map((row) => [row.name, row.id]));
  return {
    ids: names.map((n) => byName.get(n)).filter((id) => id !== undefined),
    missing: names.filter((n) => !byName.has(n)),
  };
}

async function main() {
  loadEnv();
  const dry = process.argv.includes("--dry");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "\nNEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.\n" +
        "Supabase → Project Settings → API. The service-role key is server-only —\n" +
        "never prefix it with NEXT_PUBLIC_ and never commit it.\n",
    );
    process.exit(1);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log(
    "\nDemo catalogue seed. Every row lands unverified, and dated rows say in\n" +
      "their own description that the dates are placeholders. Replace them with\n" +
      "real ones before anybody plans around this.\n",
  );

  const missingTags = new Set();
  let created = 0;
  let updated = 0;
  let tagged = 0;

  for (const entry of RESOURCES) {
    const dates = datesFor(entry);

    const goals = await lookupIds(db, "career_goals", entry.goals);
    const domains = await lookupIds(db, "technical_domains", entry.domains);
    for (const name of [...goals.missing, ...domains.missing]) missingTags.add(name);

    const { data: existing } = await db
      .from("resources")
      .select("id")
      .eq("url", entry.url)
      .maybeSingle();

    const row = {
      title: entry.title,
      description: entry.description,
      kind: entry.kind,
      provider: entry.provider,
      url: entry.url,
      estimated_hours: entry.estimatedHours,
      is_free: entry.isFree,
      ...dates,
    };

    const costWord =
      entry.isFree === true ? "free" : entry.isFree === false ? "paid" : "cost unrecorded";
    const dateWord = entry.dates ? `  exam ${dates.occurs_on}` : "";

    if (dry) {
      console.log(
        ` ${existing ? "would update" : "would create"}  ${entry.title}` +
          `\n              ${costWord}${dateWord}` +
          `  tags: ${[...entry.goals, ...entry.domains].join(", ") || "none"}`,
      );
      continue;
    }

    let resourceId = existing?.id ?? null;

    if (existing) {
      const { error } = await db.from("resources").update(row).eq("id", existing.id);
      if (error) {
        console.error(` failed  ${entry.title}: ${error.message}`);
        continue;
      }
      updated += 1;
    } else {
      const { data, error } = await db.from("resources").insert(row).select("id").single();
      if (error) {
        console.error(` failed  ${entry.title}: ${error.message}`);
        continue;
      }
      resourceId = data.id;
      created += 1;
    }

    // Tags are additive: a curator who added their own tag to a seeded row
    // should not lose it because the seed ran again.
    for (const goalId of goals.ids) {
      const { error } = await db
        .from("resource_goals")
        .upsert({ resource_id: resourceId, goal_id: goalId }, { ignoreDuplicates: true });
      if (!error) tagged += 1;
    }
    for (const domainId of domains.ids) {
      const { error } = await db
        .from("resource_domains")
        .upsert(
          { resource_id: resourceId, domain_id: domainId },
          { ignoreDuplicates: true },
        );
      if (!error) tagged += 1;
    }

    console.log(
      ` ${existing ? "updated" : "created"}  ${entry.title}  (${costWord}${dateWord})`,
    );
  }

  if (missingTags.size > 0) {
    console.warn(
      `\nThese tag names are not in the database, so those tags were skipped:\n` +
        [...missingTags].map((n) => `  - ${n}`).join("\n") +
        `\nCheck the exact names in career_goals / technical_domains and update\n` +
        `this script rather than adding a near-match by hand.\n`,
    );
  }

  if (dry) {
    console.log("\nDry run — nothing was changed.\n");
    return;
  }

  console.log(
    `\n${created} created, ${updated} updated, ${tagged} tags applied.\n` +
      `All of it is unverified. An administrator has to open each link and\n` +
      `confirm it before students stop seeing the "Not checked" badge.\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
