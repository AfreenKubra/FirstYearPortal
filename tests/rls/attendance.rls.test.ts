import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import {
  RLS_ENV_READY,
  asUser,
  cleanupFixtures,
  connect,
  createStaff,
  createStudent,
  createSubject,
  type TempStaff,
  type TempStudent,
} from "./helpers";

/**
 * Class attendance (migration 0045).
 *
 * Attendance has no release gate — a student sees it the moment it is
 * written — so the only thing between a wrong figure and a student is who
 * may write it. That rule is reused from marks (`can_edit_subject_marks`)
 * rather than restated; these tests hold the two to the same answer.
 *
 * Fixtures cascade away with their subject and students in `cleanupFixtures`,
 * so no attendance row outlives the run.
 */

const DEPT_A = "AIML";
const DEPT_B = "CSE";

let db: SupabaseClient;
let client: pg.Client;

let studentA: TempStudent;
let studentB: TempStudent;
let teacher: TempStaff;
let mentor: TempStaff;
let hod: TempStaff;
let subject: { id: string; code: string };
let otherSubject: { id: string; code: string };

const INSERT = `insert into public.student_subject_attendance
  (student_id, subject_id, classes_held, classes_attended) values ($1, $2, $3, $4)`;

describe.skipIf(!RLS_ENV_READY)("attendance RLS", () => {
  beforeAll(async () => {
    const harness = await connect();
    db = harness.db;
    client = harness.client;
    await cleanupFixtures(db);

    studentA = await createStudent(db, { department: DEPT_A, section: "A" });
    studentB = await createStudent(db, { department: DEPT_A, section: "A" });
    teacher = await createStaff(db, { role: "faculty", department: DEPT_A });
    mentor = await createStaff(db, { role: "faculty", department: DEPT_A });
    hod = await createStaff(db, { role: "hod", department: DEPT_A });
    subject = await createSubject(db, { department: DEPT_A, semester: 1 });
    otherSubject = await createSubject(db, { department: DEPT_B, semester: 1 });

    await db.from("subject_faculty").insert({
      subject_id: subject.id,
      faculty_id: teacher.facultyId,
      section: null,
    });
    await db.from("faculty_student_assignments").insert({
      faculty_id: mentor.facultyId,
      student_id: studentA.studentId,
      department_code: DEPT_A,
      is_mentor: true,
    });

    await db.from("student_subject_attendance").insert({
      student_id: studentA.studentId,
      subject_id: subject.id,
      classes_held: 40,
      classes_attended: 36,
    });
  }, 120_000);

  afterAll(async () => {
    if (db) await cleanupFixtures(db);
    if (client) await client.end();
  }, 120_000);

  describe("reading", () => {
    it("lets a student read their own attendance", async () => {
      const { rows } = await asUser<{ classes_attended: number }>(
        client,
        studentA.userId,
        "select classes_attended from public.student_subject_attendance where student_id = $1",
        [studentA.studentId],
      );
      expect(rows.map((r) => r.classes_attended)).toEqual([36]);
    });

    it("does not let a student read another student's attendance", async () => {
      const { rows } = await asUser(
        client,
        studentB.userId,
        "select 1 from public.student_subject_attendance where student_id = $1",
        [studentA.studentId],
      );
      expect(rows).toHaveLength(0);
    });

    it("lets the student's mentor read it", async () => {
      const { rows } = await asUser(
        client,
        mentor.userId,
        "select 1 from public.student_subject_attendance where student_id = $1",
        [studentA.studentId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe("writing", () => {
    it("does not let a student record their own attendance", async () => {
      const { error } = await asUser(client, studentB.userId, INSERT, [
        studentB.studentId,
        subject.id,
        40,
        40,
      ]);
      expect(error).toMatch(/row-level security/i);
    });

    it("does not let a student raise their own figures", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        `update public.student_subject_attendance set classes_attended = 40
          where student_id = $1 returning 1`,
        [studentA.studentId],
      );
      expect(rows).toHaveLength(0);
    });

    it("lets the assigned subject teacher record attendance", async () => {
      const { error } = await asUser(client, teacher.userId, INSERT, [
        studentB.studentId,
        subject.id,
        40,
        34,
      ]);
      expect(error).toBeNull();
    });

    it("does not let a mentor who does not teach the subject record it", async () => {
      // Seeing a student is not the same as keeping their register.
      const { error } = await asUser(client, mentor.userId, INSERT, [
        studentB.studentId,
        subject.id,
        40,
        34,
      ]);
      expect(error).toMatch(/row-level security/i);
    });

    it("does not let a teacher record attendance for a subject they do not teach", async () => {
      const { error } = await asUser(client, teacher.userId, INSERT, [
        studentB.studentId,
        otherSubject.id,
        40,
        34,
      ]);
      expect(error).toMatch(/row-level security/i);
    });

    it("lets the head of the subject's department record it", async () => {
      const { error } = await asUser(client, hod.userId, INSERT, [
        studentB.studentId,
        subject.id,
        40,
        34,
      ]);
      expect(error).toBeNull();
    });

    it("pins the author to whoever wrote it", async () => {
      const { rows } = await asUser<{ entered_by: string }>(
        client,
        teacher.userId,
        `${INSERT} returning entered_by`,
        [studentB.studentId, subject.id, 40, 34],
      );
      expect(rows[0]?.entered_by).toBe(teacher.facultyId);
    });

    it("refuses more classes attended than held", async () => {
      const { error } = await asUser(client, teacher.userId, INSERT, [
        studentB.studentId,
        subject.id,
        40,
        41,
      ]);
      expect(error).toMatch(/attended_within_held/);
    });
  });
});
