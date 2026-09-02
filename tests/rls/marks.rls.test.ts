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
  createSubject,
  type TempStaff,
  type TempStudent,
} from "./helpers";

/**
 * Row Level Security for internal marks (migrations 0025 and 0026).
 *
 * The three-layer model treats RLS as the backstop that holds even when
 * middleware and a server action are both wrong. Until this file, nothing
 * checked it — the policies had been verified by hand several times, which is
 * worth exactly as much as the last time somebody remembered to do it.
 *
 * Everything below runs as a real session via `asUser`, never with the
 * service-role key, because the service role bypasses the policies under test
 * and would make every assertion pass.
 */

const DEPT_A = "AIML";
const DEPT_B = "CSE";

let db: SupabaseClient;
let client: pg.Client;

let studentA: TempStudent;
let studentB: TempStudent;
let otherDeptStudent: TempStudent;
let teacher: TempStaff;
let mentor: TempStaff;
let hod: TempStaff;
let subject: { id: string; code: string };
let otherSubject: { id: string; code: string };

describe.skipIf(!RLS_ENV_READY)("marks RLS", () => {
  beforeAll(async () => {
    const harness = await connect();
    db = harness.db;
    client = harness.client;

    // A crashed previous run leaves fixtures behind; start from clean.
    await cleanupFixtures(db);

    studentA = await createStudent(db, { department: DEPT_A, section: "A" });
    studentB = await createStudent(db, { department: DEPT_A, section: "A" });
    otherDeptStudent = await createStudent(db, { department: DEPT_B });

    teacher = await createStaff(db, { role: "faculty", department: DEPT_A });
    mentor = await createStaff(db, { role: "faculty", department: DEPT_A });
    hod = await createStaff(db, { role: "hod", department: DEPT_A });

    subject = await createSubject(db, { department: DEPT_A, semester: 1 });
    otherSubject = await createSubject(db, { department: DEPT_B, semester: 1 });

    // The teacher teaches `subject`; the mentor mentors studentA but teaches
    // nothing. That pairing is what separates "may see" from "may edit".
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

    // One released mark and one withheld, for the visibility tests.
    await db.from("student_subject_marks").insert([
      {
        student_id: studentA.studentId,
        subject_id: subject.id,
        component_code: "ia1",
        marks: 17,
        max_marks: 20,
        published_at: new Date().toISOString(),
      },
      {
        student_id: studentA.studentId,
        subject_id: subject.id,
        component_code: "ia2",
        marks: 18,
        max_marks: 20,
        published_at: null,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    if (db) await cleanupFixtures(db);
    if (client) await client.end();
  }, 120_000);

  const readMarks = `select component_code from public.student_subject_marks
                     where student_id = $1 order by component_code`;

  describe("a student", () => {
    it("sees their own released marks", async () => {
      const { rows } = await asUser<{ component_code: string }>(
        client,
        studentA.userId,
        readMarks,
        [studentA.studentId],
      );
      expect(rows.map((r) => r.component_code)).toEqual(["ia1"]);
    });

    it("cannot see a component that has not been released", async () => {
      const { rows } = await asUser<{ component_code: string }>(
        client,
        studentA.userId,
        readMarks,
        [studentA.studentId],
      );
      expect(rows.map((r) => r.component_code)).not.toContain("ia2");
    });

    // The failure this whole model exists to prevent.
    it("cannot see another student's marks at all", async () => {
      const { rows } = await asUser(client, studentB.userId, readMarks, [
        studentA.studentId,
      ]);
      expect(rows).toHaveLength(0);
    });

    it("cannot edit their own marks", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        `update public.student_subject_marks set marks = 20
         where student_id = $1 and component_code = 'ia1' returning marks`,
        [studentA.studentId],
      );
      expect(rows).toHaveLength(0);
    });

    it("cannot release a component to themselves", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        `update public.student_subject_marks set published_at = now()
         where student_id = $1 and component_code = 'ia2' returning component_code`,
        [studentA.studentId],
      );
      expect(rows).toHaveLength(0);
    });

    it("cannot insert a mark for themselves", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        `insert into public.student_subject_marks
           (student_id, subject_id, component_code, marks, max_marks)
         values ($1, $2, 'activity', 10, 10) returning component_code`,
        [studentA.studentId, subject.id],
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe("a subject teacher", () => {
    it("may edit marks for the subject they teach", async () => {
      const { rows } = await asUser(
        client,
        teacher.userId,
        `update public.student_subject_marks set marks = 19
         where student_id = $1 and subject_id = $2 and component_code = 'ia1'
         returning marks`,
        [studentA.studentId, subject.id],
      );
      expect(rows).toHaveLength(1);
    });

    it("may read a component they have not released", async () => {
      const { rows } = await asUser<{ component_code: string }>(
        client,
        teacher.userId,
        readMarks,
        [studentA.studentId],
      );
      expect(rows.map((r) => r.component_code)).toContain("ia2");
    });

    it("may not edit a subject they do not teach", async () => {
      const { rows } = await asUser<{ v: boolean }>(
        client,
        teacher.userId,
        "select public.can_edit_subject_marks($1, $2) as v",
        [otherSubject.id, studentA.studentId],
      );
      expect(rows[0].v).toBe(false);
    });

    it("may not see a student outside the subject's department", async () => {
      const { rows } = await asUser<{ v: boolean }>(
        client,
        teacher.userId,
        "select public.can_faculty_view_student($1) as v",
        [otherDeptStudent.studentId],
      );
      expect(rows[0].v).toBe(false);
    });

    // Teaching somebody is not being accountable for ringing their home.
    it("does not count as the assigned mentor, so guardian contact stays masked", async () => {
      const { rows } = await asUser<{ v: boolean }>(
        client,
        teacher.userId,
        "select public.can_faculty_view_student($1, true) as v",
        [studentA.studentId],
      );
      expect(rows[0].v).toBe(false);
    });
  });

  describe("a mentor who teaches nothing", () => {
    it("may read their mentee's marks", async () => {
      const { rows } = await asUser(client, mentor.userId, readMarks, [
        studentA.studentId,
      ]);
      expect(rows.length).toBeGreaterThan(0);
    });

    // The point of 0026: seeing a card is not permission to rewrite it.
    it("may NOT edit them", async () => {
      const { rows } = await asUser(
        client,
        mentor.userId,
        `update public.student_subject_marks set marks = 1
         where student_id = $1 and component_code = 'ia1' returning marks`,
        [studentA.studentId],
      );
      expect(rows).toHaveLength(0);
    });

    it("is still recognised as the mentor for guardian contact", async () => {
      const { rows } = await asUser<{ v: boolean }>(
        client,
        mentor.userId,
        "select public.can_faculty_view_student($1, true) as v",
        [studentA.studentId],
      );
      expect(rows[0].v).toBe(true);
    });
  });

  describe("a head of department", () => {
    it("may edit marks in their department without teaching the subject", async () => {
      const { rows } = await asUser<{ v: boolean }>(
        client,
        hod.userId,
        "select public.can_edit_subject_marks($1, $2) as v",
        [subject.id, studentA.studentId],
      );
      expect(rows[0].v).toBe(true);
    });

    it("may not edit another department's subject", async () => {
      const { rows } = await asUser<{ v: boolean }>(
        client,
        hod.userId,
        "select public.can_edit_subject_marks($1, $2) as v",
        [otherSubject.id, otherDeptStudent.studentId],
      );
      expect(rows[0].v).toBe(false);
    });

    it("may assign a teacher within their own department", async () => {
      const { rows } = await asUser(
        client,
        hod.userId,
        `insert into public.subject_faculty (subject_id, faculty_id, section)
         values ($1, $2, 'B') returning id`,
        [subject.id, mentor.facultyId],
      );
      expect(rows).toHaveLength(1);
    });

    it("may not assign a teacher in another department", async () => {
      const { rows, error } = await asUser(
        client,
        hod.userId,
        `insert into public.subject_faculty (subject_id, faculty_id, section)
         values ($1, $2, null) returning id`,
        [otherSubject.id, mentor.facultyId],
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe("a plain faculty member", () => {
    it("may not assign teachers at all", async () => {
      const { rows, error } = await asUser(
        client,
        teacher.userId,
        `insert into public.subject_faculty (subject_id, faculty_id, section)
         values ($1, $2, 'C') returning id`,
        [subject.id, teacher.facultyId],
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe("notifications (0028)", () => {
    it("cannot be forged by a session, since there is no INSERT policy", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        `insert into public.notifications (user_id, kind, title)
         values ($1, 'marks_released', 'Fake') returning id`,
        [studentA.userId],
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });

    it("cannot be read by anyone but their addressee", async () => {
      const { rows } = await asUser(
        client,
        studentB.userId,
        "select id from public.notifications where user_id = $1",
        [studentA.userId],
      );
      expect(rows).toHaveLength(0);
    });
  });
});
