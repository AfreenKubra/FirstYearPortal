import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  RLS_ENV_READY,
  asUser,
  cleanupFixtures,
  connect,
  createStaff,
  createStudent,
  type TempStaff,
  type TempStudent,
} from "./helpers";

/**
 * The policies protecting student data outside the marks module, plus the
 * rate limiter's own reachability.
 *
 * `marks.rls.test.ts` covers 0025/0026. This file covers the older tables
 * that were never checked by anything, and the invariant they all share: a
 * student sees their own row and nobody else's, and cannot promote their own
 * records.
 */

const DEPT = "AIML";

let db: SupabaseClient;
let client: pg.Client;
let studentA: TempStudent;
let studentB: TempStudent;
let outsider: TempStaff;
let achievementId: string;

describe.skipIf(!RLS_ENV_READY)("core RLS", () => {
  beforeAll(async () => {
    const harness = await connect();
    db = harness.db;
    client = harness.client;
    await cleanupFixtures(db);

    studentA = await createStudent(db, { department: DEPT });
    studentB = await createStudent(db, { department: DEPT });
    // Staff in another department, mentoring nobody and teaching nothing —
    // the "has an account but no relationship" case.
    outsider = await createStaff(db, { role: "faculty", department: "CSE" });

    const { data, error } = await db
      .from("achievements")
      .insert({
        student_id: studentA.studentId,
        category: "certification",
        title: "RLS fixture achievement",
        level: "college",
        achieved_on: "2026-01-15",
      })
      .select("id")
      .single();
    if (error) throw new Error(`achievements insert: ${error.message}`);
    achievementId = data.id;
  }, 120_000);

  afterAll(async () => {
    if (db) {
      await db.from("achievements").delete().eq("id", achievementId);
      await cleanupFixtures(db);
    }
    if (client) await client.end();
  }, 120_000);

  describe("students table", () => {
    it("lets a student read their own row", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.students where id = $1",
        [studentA.studentId],
      );
      expect(rows).toHaveLength(1);
    });

    it("does not let a student read another student's row", async () => {
      const { rows } = await asUser(
        client,
        studentB.userId,
        "select id from public.students where id = $1",
        [studentA.studentId],
      );
      expect(rows).toHaveLength(0);
    });

    it("does not let a student see the whole cohort", async () => {
      const { rows } = await asUser<{ id: string }>(
        client,
        studentA.userId,
        "select id from public.students",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(studentA.studentId);
    });

    it("does not let unrelated staff read a student outside their scope", async () => {
      const { rows } = await asUser(
        client,
        outsider.userId,
        "select id from public.students where id = $1",
        [studentA.studentId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe("achievements", () => {
    it("lets the owner read their own", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.achievements where id = $1",
        [achievementId],
      );
      expect(rows).toHaveLength(1);
    });

    it("hides one student's achievements from another", async () => {
      const { rows } = await asUser(
        client,
        studentB.userId,
        "select id from public.achievements where id = $1",
        [achievementId],
      );
      expect(rows).toHaveLength(0);
    });

    // The guard that stops a student awarding themselves a verified record.
    it("does not let a student verify their own achievement", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        `update public.achievements
         set verification_status = 'verified'
         where id = $1 returning verification_status`,
        [achievementId],
      );
      const stuck = rows.length === 0 || error !== null;
      expect(stuck).toBe(true);

      // Whatever the policy did, the stored value must still be pending.
      const { data } = await db
        .from("achievements")
        .select("verification_status")
        .eq("id", achievementId)
        .single();
      expect(data?.verification_status).toBe("pending");
    });

    it("does not let unrelated staff verify it either", async () => {
      await asUser(
        client,
        outsider.userId,
        `update public.achievements set verification_status = 'verified'
         where id = $1 returning id`,
        [achievementId],
      );
      const { data } = await db
        .from("achievements")
        .select("verification_status")
        .eq("id", achievementId)
        .single();
      expect(data?.verification_status).toBe("pending");
    });
  });

  describe("audit log", () => {
    // Append-only and admin-read-only: an action cannot be performed without
    // leaving a record, and the record cannot be edited afterwards.
    it("is not readable by a student", async () => {
      const { rows } = await asUser(
        client,
        studentA.userId,
        "select id from public.audit_logs limit 1",
      );
      expect(rows).toHaveLength(0);
    });

    it("cannot be written by a session", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        `insert into public.audit_logs (actor_user_id, action, entity_type, entity_id)
         values ($1, 'forged', 'test', 'test') returning id`,
        [studentA.userId],
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe("admin allow-list", () => {
    it("cannot be widened from inside the application", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        `insert into public.admin_allowlist (email, note)
         values ('attacker@example.com', 'nope') returning email`,
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });

    it("refuses a student promoting themselves to admin", async () => {
      await asUser(
        client,
        studentA.userId,
        "update public.users set role = 'admin' where id = $1 returning role",
        [studentA.userId],
      );
      const { data } = await db
        .from("users")
        .select("role")
        .eq("id", studentA.userId)
        .single();
      expect(data?.role).toBe("student");
    });
  });

  describe("auth rate limiter (0029)", () => {
    // This is a regression test for a real bug. The first version of 0029
    // revoked EXECUTE from anon and authenticated but not from PUBLIC, which
    // Postgres grants by default — so the revoke changed nothing and any
    // caller could burn a chosen account's allowance, locking that student
    // out on demand.
    it("cannot be consumed by a signed-in session", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        "select public.consume_rate_limit('probe', 1, 60) as v",
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });

    it("cannot be cleared by a signed-in session", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        "select public.clear_rate_limit('probe')",
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });

    it("keeps its table unreadable, so buckets cannot enumerate accounts", async () => {
      const { rows, error } = await asUser(
        client,
        studentA.userId,
        "select bucket from public.auth_rate_limits limit 1",
      );
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });
});
