/**
 * Seeds the six skill-area papers from `src/config/question-banks.ts`.
 *
 * Every paper lands UNPUBLISHED, and that is the whole safety story. The
 * questions were drafted by an assistant, not written by a subject lecturer
 * and not moderated. The moment one is published, students are scored on it
 * and mentors read those scores as evidence about them — so a wrong answer
 * key becomes a wrong judgement about a real person. Publishing is a
 * deliberate act a member of staff performs in the UI, after reading the
 * paper. This script cannot do it and does not try: `is_published` is written
 * as `false` on insert and left alone on update, so re-running the seed can
 * never silently un-publish or publish anything.
 *
 * The content is imported from the TypeScript config rather than copied here,
 * so there is exactly one copy of every answer key — the one under version
 * control that `src/config/__tests__/question-banks.test.ts` checks.
 *
 * Re-running is safe and is the intended way to pick up edits to the config:
 * a paper is matched by title, and its questions are rebuilt from the bank.
 * Deleting and re-inserting the questions would cascade away any attempts
 * already made against them, so a paper that already has attempts is left
 * completely alone and reported instead.
 *
 * Usage:
 *   node scripts/seed-question-banks.mjs --dry   # show, change nothing
 *   node scripts/seed-question-banks.mjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { QUESTION_BANKS } from "../src/config/question-banks.ts";

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

async function main() {
  loadEnv();
  const dry = process.argv.includes("--dry");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "\nNEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.\n",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let created = 0;
  let rebuilt = 0;
  let skipped = 0;

  for (const bank of QUESTION_BANKS) {
    const questionCount = bank.questions.length;

    const { data: existing, error: findError } = await supabase
      .from("assessments")
      .select("id, is_published")
      .eq("title", bank.title)
      .maybeSingle();

    if (findError) {
      console.error(`  ERROR reading ${bank.title}: ${findError.message}`);
      continue;
    }

    if (existing) {
      // An attempt references its questions. Rebuilding them would cascade
      // those attempts away and destroy a student's result, so a paper that
      // has been sat is never touched by this script.
      const { count } = await supabase
        .from("assessment_attempts")
        .select("id", { count: "exact", head: true })
        .eq("assessment_id", existing.id);

      if ((count ?? 0) > 0) {
        console.log(
          `  skipped   ${bank.title} — ${count} attempt(s) already made against it`,
        );
        skipped += 1;
        continue;
      }
    }

    if (dry) {
      console.log(
        `  ${existing ? "would rebuild" : "would create "} ${bank.title} — ${questionCount} questions, ${bank.durationMinutes} min`,
      );
      continue;
    }

    let assessmentId = existing?.id;

    if (!assessmentId) {
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          title: bank.title,
          description: bank.description,
          kind: bank.kind,
          skill_category: bank.categoryId,
          duration_minutes: bank.durationMinutes,
          pass_percentage: bank.passPercentage,
          max_attempts: 3,
          // Question order is shuffled per attempt by the engine.
          randomise_questions: true,
          // Never true, never configurable from here. See the header.
          is_published: false,
          // No department, semester, or section: the six skill papers are for
          // everyone. Narrowing the audience is a decision for whoever
          // publishes the paper, made in the UI where they can see it.
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error(`  ERROR creating ${bank.title}: ${error?.message}`);
        continue;
      }
      assessmentId = data.id;
      created += 1;
    } else {
      const { error } = await supabase
        .from("assessments")
        .update({
          description: bank.description,
          kind: bank.kind,
          skill_category: bank.categoryId,
          duration_minutes: bank.durationMinutes,
          pass_percentage: bank.passPercentage,
          randomise_questions: true,
          // `is_published` deliberately absent: a paper a reviewer has already
          // published stays published, and re-seeding never publishes one.
        })
        .eq("id", assessmentId);

      if (error) {
        console.error(`  ERROR updating ${bank.title}: ${error.message}`);
        continue;
      }

      await supabase.from("questions").delete().eq("assessment_id", assessmentId);
      rebuilt += 1;
    }

    for (const [index, question] of bank.questions.entries()) {
      const { data: row, error } = await supabase
        .from("questions")
        .insert({
          assessment_id: assessmentId,
          kind: question.kind,
          prompt: question.prompt,
          position: index,
          points: 1,
          required: false,
        })
        .select("id")
        .single();

      if (error || !row) {
        console.error(`  ERROR on ${question.id}: ${error?.message}`);
        continue;
      }

      const options = question.options.map((option, position) => ({
        question_id: row.id,
        label: option.label,
        position,
        // NULL, not false, on a Likert item: "not auto-marked" and "marked and
        // wrong" are different claims, and 0013's grading path relies on the
        // difference.
        is_correct:
          question.kind === "likert" ? null : option.correct === true,
        score_value: option.scoreValue ?? 0,
      }));

      const { error: optionError } = await supabase
        .from("question_options")
        .insert(options);

      if (optionError) {
        console.error(`  ERROR on ${question.id} options: ${optionError.message}`);
      }
    }

    console.log(
      `  ${existing ? "rebuilt" : "created"}   ${bank.title} — ${questionCount} questions`,
    );
  }

  if (dry) {
    console.log("\nDry run — nothing was written.\n");
    return;
  }

  console.log(
    `\n${created} created, ${rebuilt} rebuilt, ${skipped} skipped.\n\n` +
      "Every paper is UNPUBLISHED. Nothing reaches a student until a member\n" +
      "of staff opens it under /faculty/assessments, reads the questions and\n" +
      "the answer keys, and publishes it deliberately.\n",
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
