import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RLS_ENV_READY,
  asUser,
  cleanupFixtures,
  connect,
  createStaff,
  createStudent,
  FIXTURE_PREFIX,
  type TempStaff,
  type TempStudent,
} from "./helpers";

/**
 * Events, assessments, resources, and roadmaps (migrations 0013–0016, as
 * amended by 0019).
 *
 * These four shipped in the August merge that never went through a pull
 * request — seventeen policies and eleven triggers that no second pair of
 * eyes and no test has ever looked at (MANUAL-STEPS section 8). This file is
 * the first thing to check any of them.
 *
 * The shape of every test is the same question asked of a different table:
 * can one student reach another's row, and can a student promote their own?
 */

const DEPT = "AIML";
const OTHER_DEPT = "CSE";

let db: SupabaseClient;
let client: pg.Client;

let studentA: TempStudent;
let studentB: TempStudent;
let author: TempStaff;
let outsider: TempStaff;
/** Assigned to studentA but NOT as their mentor — see the psychometric test. */
let viewer: TempStaff;
/** studentA's actual assigned mentor. */
let mentor: TempStaff;

let publishedEventId: string;
let draftEventId: string;
let generalAssessmentId: string;
let psychometricAssessmentId: string;
let attemptId: string;
let psychAttemptId: string;
let resourceId: string;
let roadmapId: string;
let supersededRoadmapId: string;

/** Ids to remove by hand; the prefix cleanup does not reach these tables. */
const extraCleanup: Array<[string, string]> = [];

describe.skipIf(!RLS_ENV_READY)("feature-module RLS", () => {
  beforeAll(async () => {
    const harness = await connect();
    db = harness.db;
    client = harness.client;
    await cleanupFixtures(db);

    studentA = await createStudent(db, { department: DEPT, semester: 1, section: "A" });
    studentB = await createStudent(db, { department: DEPT, semester: 1, section: "A" });
    author = await createStaff(db, { role: "faculty", department: DEPT });
    outsider = await createStaff(db, { role: "faculty", department: OTHER_DEPT });

    // Can see studentA, but is not their mentor. Without this the
    // psychometric test would pass for the wrong reason: a staff member with
    // no relationship at all fails `can_faculty_view_student` first, so the
    // psychometric clause would never be reached and the assertion would hold
    // even if that clause were deleted.
    viewer = await createStaff(db, { role: "faculty", department: DEPT });
    await db.from("faculty_student_assignments").insert({
      faculty_id: viewer.facultyId,
      student_id: studentA.studentId,
      department_code: DEPT,
      is_mentor: false,
    });

    // The person PRD 5.7 says a psychometric result is actually for. Without
    // asserting the positive too, "hide it from everyone" would pass the
    // negative tests while breaking the feature.
    mentor = await createStaff(db, { role: "faculty", department: DEPT });
    await db.from("faculty_student_assignments").insert({
      faculty_id: mentor.facultyId,
      student_id: studentA.studentId,
      department_code: DEPT,
      is_mentor: true,
    });

    const soon = new Date(Date.now() + 7 * 864e5).toISOString();

    // --- events ------------------------------------------------------------
    const { data: published, error: pubErr } = await db
      .from("events")
      .insert({
        title: `${FIXTURE_PREFIX} published event`,
        kind: "workshop",
        created_by: author.facultyId,
        department_code: DEPT,
        starts_at: soon,
        is_published: true,
      })
      .select("id")
      .single();
    if (pubErr) throw new Error(`events insert: ${pubErr.message}`);
    publishedEventId = published.id;
    extraCleanup.push(["events", publishedEventId]);

    const { data: draft } = await db
      .from("events")
      .insert({
        title: `${FIXTURE_PREFIX} draft event`,
        kind: "workshop",
        created_by: author.facultyId,
        department_code: DEPT,
        starts_at: soon,
        is_published: false,
      })
      .select("id")
      .single();
    draftEventId = draft!.id;
    extraCleanup.push(["events", draftEventId]);

    // --- assessments -------------------------------------------------------
    const { data: general } = await db
      .from("assessments")
      .insert({
        title: `${FIXTURE_PREFIX} general paper`,
        kind: "general",
        created_by: author.facultyId,
        department_code: DEPT,
        is_published: true,
      })
      .select("id")
      .single();
    generalAssessmentId = general!.id;
    extraCleanup.push(["assessments", generalAssessmentId]);

    const { data: psych } = await db
      .from("assessments")
      .insert({
        title: `${FIXTURE_PREFIX} psychometric paper`,
        kind: "psychometric",
        created_by: author.facultyId,
        department_code: DEPT,
        is_published: true,
      })
      .select("id")
      .single();
    psychometricAssessmentId = psych!.id;
    extraCleanup.push(["assessments", psychometricAssessmentId]);

    const { data: attempt } = await db
      .from("assessment_attempts")
      .insert({
        assessment_id: generalAssessmentId,
        student_id: studentA.studentId,
        status: "graded",
        percentage: 72,
      })
      .select("id")
      .single();
    attemptId = attempt!.id;

    const { data: psychAttempt } = await db
      .from("assessment_attempts")
      .insert({
        assessment_id: psychometricAssessmentId,
        student_id: studentA.studentId,
        status: "graded",
        percentage: 61,
      })
      .select("id")
      .single();
    psychAttemptId = psychAttempt!.id;

    // --- resources ---------------------------------------------------------
    const { data: resource, error: resErr } = await db
      .from("resources")
      .insert({
        title: `${FIXTURE_PREFIX} resource`,
        kind: "course",
        url: "https://example.org/course",
        department_code: DEPT,
      })
      .select("id")
      .single();
    if (resErr) throw new Error(`resources insert: ${resErr.message}`);
    resourceId = resource.id;
    extraCleanup.push(["resources", resourceId]);

    // --- roadmaps ----------------------------------------------------------
    const { data: roadmap, error: rmErr } = await db
      .from("student_roadmaps")
      .insert({
        student_id: studentA.studentId,
        generated_by: "rule_based",
        approval_status: "auto",
      })
      .select("id")
      .single();
    if (rmErr) throw new Error(`student_roadmaps insert: ${rmErr.message}`);
    roadmapId = roadmap.id;

    const { data: superseded } = await db
      .from("student_roadmaps")
      .insert({
        student_id: studentA.studentId,
        generated_by: "rule_based",
        approval_status: "superseded",
      })
      .select("id")
      .single();
    supersededRoadmapId = superseded!.id;
  }, 180_000);

  afterAll(async () => {
    if (db) {
      // Children first where there is no cascade from the fixture prefix.
      await db.from("assessment_attempts").delete().eq("id", attemptId);
      await db.from("assessment_attempts").delete().eq("id", psychAttemptId);
      await db.from("student_roadmaps").delete().eq("id", roadmapId);
      await db.from("student_roadmaps").delete().eq("id", supersededRoadmapId);
      for (const [table, id] of extraCleanup.reverse()) {
        await db.from(table).delete().eq("id", id);
      }
      await cleanupFixtures(db);
    }
    if (client) await client.end();
  }, 180_000);

  describe("events", () => {
    it("shows a published event to a targeted student", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.events where id = $1",
        [publishedEventId],
      );
      expect(rows).toHaveLength(1);
    });

    // Publishing is the switch that makes an event real; a draft is a
    // half-written plan a student must not be able to read.
    it("hides an unpublished event from students", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.events where id = $1",
        [draftEventId],
      );
      expect(rows).toHaveLength(0);
    });

    it("hides a department's event from a student in another department", async () => {
      const other = await createStudent(db, { department: OTHER_DEPT });
      const { rows } = await asUser(
        client,
        other.userId,
        "select id from public.events where id = $1",
        [publishedEventId],
      );
      expect(rows).toHaveLength(0);
    });

    it("does not let a student publish an event", async () => {
      await asUser(
        client,
        studentA.userId,
        "update public.events set is_published = true where id = $1 returning id",
        [draftEventId],
      );
      const { data } = await db
        .from("events")
        .select("is_published")
        .eq("id", draftEventId)
        .single();
      expect(data?.is_published).toBe(false);
    });

    it("does not let unrelated staff edit somebody else's event", async () => {
      await asUser(
        client,
        outsider.userId,
        "update public.events set title = 'hijacked' where id = $1 returning id",
        [publishedEventId],
      );
      const { data } = await db
        .from("events")
        .select("title")
        .eq("id", publishedEventId)
        .single();
      expect(data?.title).toContain(FIXTURE_PREFIX);
    });

    it("does not let a student register somebody else for an event", async () => {
      const { rows, error } = await asUser(
        client,
        studentB.userId,
        `insert into public.event_registrations (event_id, student_id)
         values ($1, $2) returning id`,
        [publishedEventId, studentA.studentId],
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe("assessments", () => {
    it("lets a student read their own attempt", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.assessment_attempts where id = $1",
        [attemptId],
      );
      expect(rows).toHaveLength(1);
    });

    it("hides one student's attempt from another", async () => {
      const { rows } = await asUser(
        client,
        studentB.userId,
        "select id from public.assessment_attempts where id = $1",
        [attemptId],
      );
      expect(rows).toHaveLength(0);
    });

    // PRD 5.7: a psychometric result reaches the student and their assigned
    // mentor, and nobody else — a stricter rule than everything around it.
    //
    // The pair matters. `viewer` is assigned to studentA but is not their
    // mentor, so they pass `can_faculty_view_student` and reach the
    // psychometric clause. Asserting only the negative with a staff member
    // who cannot see the student at all would pass even if that clause were
    // removed, which is a test that proves nothing.
    it("lets assigned staff read an ordinary attempt", async () => {
      const { rows } = await asUser(
        client,
        viewer.userId,
        "select id from public.assessment_attempts where id = $1",
        [attemptId],
      );
      expect(rows).toHaveLength(1);
    });

    it("hides a psychometric attempt from that same assigned staff member", async () => {
      const { rows } = await asUser(
        client,
        viewer.userId,
        "select id from public.assessment_attempts where id = $1",
        [psychAttemptId],
      );
      expect(rows).toHaveLength(0);
    });

    it("still lets the assigned mentor read it, which is who it is for", async () => {
      const { rows } = await asUser(
        client,
        mentor.userId,
        "select id from public.assessment_attempts where id = $1",
        [psychAttemptId],
      );
      expect(rows).toHaveLength(1);
    });

    it("does not let a student mark their own attempt", async () => {
      await asUser(
        client,
        studentA.userId,
        `update public.assessment_attempts set percentage = 100, passed = true
         where id = $1 returning id`,
        [attemptId],
      );
      const { data } = await db
        .from("assessment_attempts")
        .select("percentage")
        .eq("id", attemptId)
        .single();
      expect(Number(data?.percentage)).toBe(72);
    });

    it("does not let a student publish an assessment", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        `insert into public.assessments (title, kind, is_published)
         values ('forged paper', 'general', true) returning id`,
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe("resources", () => {
    it("is readable by any signed-in student, since the catalogue is shared", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.resources where id = $1",
        [resourceId],
      );
      expect(rows).toHaveLength(1);
    });

    // PRD 5.9: an unverified entry stays visibly unverified until an
    // administrator confirms it. Anyone else flipping the flag would make the
    // "admin-verified" badge meaningless.
    it("does not let a student verify a resource", async () => {
      await asUser(
        client,
        studentA.userId,
        "update public.resources set is_verified = true where id = $1 returning id",
        [resourceId],
      );
      const { data } = await db
        .from("resources")
        .select("is_verified")
        .eq("id", resourceId)
        .single();
      expect(data?.is_verified).toBe(false);
    });

    it("does not let a faculty member verify one either", async () => {
      await asUser(
        client,
        author.userId,
        "update public.resources set is_verified = true where id = $1 returning id",
        [resourceId],
      );
      const { data } = await db
        .from("resources")
        .select("is_verified")
        .eq("id", resourceId)
        .single();
      expect(data?.is_verified).toBe(false);
    });

    it("does not let a student save a resource to somebody else's list", async () => {
      const { rows, error } = await asUser(
        client,
        studentB.userId,
        `insert into public.student_resources (student_id, resource_id)
         values ($1, $2) returning student_id`,
        [studentA.studentId, resourceId],
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe("roadmaps", () => {
    it("lets a student read their own current plan", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.student_roadmaps where id = $1",
        [roadmapId],
      );
      expect(rows).toHaveLength(1);
    });

    // 0019 kept 'superseded' hidden: it is the previous version of a plan the
    // student can already see, and showing both presents contradictory advice.
    it("hides a superseded plan even from its own student", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.student_roadmaps where id = $1",
        [supersededRoadmapId],
      );
      expect(rows).toHaveLength(0);
    });

    it("hides one student's roadmap from another", async () => {
      const { rows } = await asUser(
        client,
        studentB.userId,
        "select id from public.student_roadmaps where id = $1",
        [roadmapId],
      );
      expect(rows).toHaveLength(0);
    });

    // Mentor endorsement is the one claim on a plan a student must not be
    // able to make about their own.
    it("does not let a student approve their own roadmap", async () => {
      await asUser(
        client,
        studentA.userId,
        `update public.student_roadmaps set approval_status = 'approved'
         where id = $1 returning id`,
        [roadmapId],
      );
      const { data } = await db
        .from("student_roadmaps")
        .select("approval_status")
        .eq("id", roadmapId)
        .single();
      expect(data?.approval_status).toBe("auto");
    });

    it("does not let unrelated staff read a roadmap outside their scope", async () => {
      const { rows } = await asUser(
        client,
        outsider.userId,
        "select id from public.student_roadmaps where id = $1",
        [roadmapId],
      );
      expect(rows).toHaveLength(0);
    });
  });
});
