import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RLS_ENV_READY,
  cleanupFixtures,
  connect,
  createStaff,
  createStudent,
  FIXTURE_PREFIX,
  type TempStaff,
  type TempStudent,
} from "./helpers";
import pg from "pg";

/**
 * Who an assessment is for (migration 0041).
 *
 * `assessment_targets_student()` is not a convenience function — it is what
 * the RLS policy on `assessments` reads, so it decides whether a paper is
 * visible at all. 0041 rewrote it from a single `semester` to an inclusive
 * range, and a mistake in that rewrite has two shapes, both silent: a paper
 * that stops reaching the students it was set for, or one that reaches
 * students it was never meant for.
 *
 * The single-semester version could not express "first year" at all, which is
 * the case these tests care most about.
 */

const DEPT = "AIML";

let db: SupabaseClient;
let client: pg.Client;

let sem1: TempStudent;
let sem2: TempStudent;
let sem3: TempStudent;
let noSemester: TempStudent;
let author: TempStaff;

const papers: Record<string, string> = {};

/**
 * Papers this file created, deleted by id in `afterAll`.
 *
 * `cleanupFixtures` does not remove assessments, and an assessment's
 * `created_by` is `on delete set null`, so deleting the fixture faculty
 * leaves the paper behind — published, audience-matched, and visible to real
 * students. Fifteen had accumulated in the shared database before anyone
 * noticed. They are tracked by id rather than swept by title prefix, because
 * every file shares that prefix and a sweep would delete rows another file is
 * still using.
 */
const createdPaperIds: string[] = [];

async function makePaper(
  name: string,
  scope: { semester_min?: number | null; semester_max?: number | null },
) {
  const { data, error } = await db
    .from("assessments")
    .insert({
      title: `${FIXTURE_PREFIX} ${name}`,
      kind: "general",
      created_by: author.facultyId,
      is_published: true,
      ...scope,
    })
    .select("id")
    .single();
  if (error) throw new Error(`${name}: ${error.message}`);
  papers[name] = data!.id;
  createdPaperIds.push(data!.id);
}

/** Asks the database the same question RLS asks. */
async function targets(paper: string, student: TempStudent): Promise<boolean> {
  const { rows } = await client.query(
    "select public.assessment_targets_student($1, $2) as hit",
    [papers[paper], student.studentId],
  );
  return rows[0].hit === true;
}

describe.runIf(RLS_ENV_READY)("assessment audience by semester range", () => {
  beforeAll(async () => {
    const harness = await connect();
    db = harness.db;
    client = harness.client;

    author = await createStaff(db, { department: DEPT, role: "faculty" });
    sem1 = await createStudent(db, { department: DEPT, semester: 1 });
    sem2 = await createStudent(db, { department: DEPT, semester: 2 });
    sem3 = await createStudent(db, { department: DEPT, semester: 3 });
    // The helper defaults the profile to semester 1, so this student's
    // semester is cleared explicitly — "no semester on file" is the state
    // being tested, and defaulting it would have made the test pass without
    // exercising anything.
    noSemester = await createStudent(db, { department: DEPT });
    await db
      .from("student_academic_profiles")
      .update({ semester: null })
      .eq("student_id", noSemester.studentId);

    await makePaper("first year", { semester_min: 1, semester_max: 2 });
    await makePaper("sem one only", { semester_min: 1, semester_max: 1 });
    await makePaper("any semester", {});
  }, 120_000);

  afterAll(async () => {
    for (const id of createdPaperIds) {
      await db.from("assessments").delete().eq("id", id);
    }
    await cleanupFixtures(db);
    await client.end();
  });

  it("reaches both semesters of first year", () => {
    // The case the old single-semester column could not express, and the
    // reason this migration exists.
    return Promise.all([
      expect(targets("first year", sem1)).resolves.toBe(true),
      expect(targets("first year", sem2)).resolves.toBe(true),
    ]);
  });

  it("stops at the end of the range", async () => {
    expect(await targets("first year", sem3)).toBe(false);
  });

  it("still supports a single semester, as a range of one", async () => {
    // Every paper that existed before 0041 was migrated to min = max, so this
    // is the behaviour those papers rely on continuing to have.
    expect(await targets("sem one only", sem1)).toBe(true);
    expect(await targets("sem one only", sem2)).toBe(false);
  });

  it("reaches everyone when no semester is named", async () => {
    expect(await targets("any semester", sem1)).toBe(true);
    expect(await targets("any semester", sem3)).toBe(true);
  });

  it("does not sweep a student with no semester on file into a scoped paper", async () => {
    // `ap.semester` is NULL, so `between` yields NULL rather than true. This
    // matches what `a.semester = ap.semester` did before, and it is the whole
    // reason to check: a rewrite to `>=`/`<=` with a coalesce would quietly
    // start including these students.
    expect(await targets("first year", noSemester)).toBe(false);
    expect(await targets("sem one only", noSemester)).toBe(false);
  });

  it("still reaches a student with no semester when the paper names none", async () => {
    expect(await targets("any semester", noSemester)).toBe(true);
  });

  it("refuses a range that ends before it starts", async () => {
    const { error } = await db.from("assessments").insert({
      title: `${FIXTURE_PREFIX} backwards`,
      kind: "general",
      created_by: author.facultyId,
      semester_min: 5,
      semester_max: 2,
    });
    expect(error).not.toBeNull();
  });

  it("refuses one bound without the other", async () => {
    const { error } = await db.from("assessments").insert({
      title: `${FIXTURE_PREFIX} half a range`,
      kind: "general",
      created_by: author.facultyId,
      semester_min: 1,
    });
    expect(error).not.toBeNull();
  });
});
