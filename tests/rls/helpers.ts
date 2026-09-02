import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

/**
 * Harness for the RLS suite.
 *
 * These tests exist because the policies are the last line of the three-layer
 * model (ARCHITECTURE section 3) and were the only layer nothing re-checked.
 * A middleware or server-action mistake is caught by a unit test or a type
 * error; a widened policy is caught by nobody, and the failure mode is a
 * student reading another student's marks.
 *
 * They run against a real database because that is the only place a policy
 * exists — there is no way to assert on RLS without Postgres evaluating it.
 * That is why they are NOT part of `npm test`: they need `DATABASE_URL` and a
 * service-role key, which CI and a fresh clone do not have. `npm run test:rls`
 * runs them deliberately.
 *
 * Every fixture is created and torn down inside the run. Nothing here writes
 * to a row that existed beforehand.
 */

function loadEnv() {
  const root = join(__dirname, "..", "..");
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, value] = match;
        if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    } catch {
      // Absent file is fine — the variables may already be exported.
    }
  }
}

loadEnv();

export const RLS_ENV_READY = Boolean(
  process.env.DATABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** Prefix on everything this suite creates, so strays are identifiable. */
export const FIXTURE_PREFIX = "zzrls";

export type Harness = {
  /** Service role — bypasses RLS. Used only to build and tear down fixtures. */
  db: SupabaseClient;
  /** Direct connection, for impersonating a session. */
  client: pg.Client;
};

export async function connect(): Promise<Harness> {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  return { db, client };
}

/**
 * Runs SQL as if `userId` were the signed-in user.
 *
 * `set local role authenticated` plus the JWT claim is what makes `auth.uid()`
 * resolve inside the policies — the service-role key cannot be used here,
 * because it bypasses the very thing under test. Everything runs inside a
 * transaction that is always rolled back, so a test asserting that a write is
 * *permitted* still leaves no trace.
 */
export async function asUser<T = unknown>(
  client: pg.Client,
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; error: string | null }> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      `set local request.jwt.claims = '${JSON.stringify({
        sub: userId,
        role: "authenticated",
      })}'`,
    );
    const result = await client.query(sql, params);
    return { rows: result.rows as T[], error: null };
  } catch (error) {
    return { rows: [], error: (error as Error).message };
  } finally {
    await client.query("rollback");
  }
}

/** Same, but the transaction commits — for setting up state as a real user. */
export async function asUserCommitted<T = unknown>(
  client: pg.Client,
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; error: string | null }> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      `set local request.jwt.claims = '${JSON.stringify({
        sub: userId,
        role: "authenticated",
      })}'`,
    );
    const result = await client.query(sql, params);
    await client.query("commit");
    return { rows: result.rows as T[], error: null };
  } catch (error) {
    await client.query("rollback");
    return { rows: [], error: (error as Error).message };
  }
}

let counter = 0;
function unique(): string {
  counter += 1;
  return `${Date.now().toString().slice(-7)}${counter.toString().padStart(2, "0")}`;
}

export type TempStudent = {
  userId: string;
  studentId: string;
  email: string;
};

export async function createStudent(
  db: SupabaseClient,
  opts: { department: string; semester?: number; section?: string },
): Promise<TempStudent> {
  const id = unique();
  const email = `${FIXTURE_PREFIX}-stu-${id}@hkbk.edu.in`;

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: `Zz!${id}Aa9`,
    email_confirm: true,
    user_metadata: { role: "student" },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const userId = created.user.id;

  await db.from("users").update({ role: "student", status: "active" }).eq("id", userId);

  const { data: student, error: sErr } = await db
    .from("students")
    .insert({
      user_id: userId,
      full_name: `RLS Fixture ${id}`,
      dob: "2007-01-01",
      usn: `${FIXTURE_PREFIX.toUpperCase()}${id}`,
      phone: `90${id}`,
      email,
      username: `${FIXTURE_PREFIX}${id}`,
      state: "Karnataka",
      city: "Bengaluru",
      department_code: opts.department,
      guardian_name: "Fixture Guardian",
      guardian_phone: `91${id}`,
      profile_completion_percent: 100,
    })
    .select("id")
    .single();
  if (sErr) throw new Error(`students insert: ${sErr.message}`);

  await db.from("student_academic_profiles").insert({
    student_id: student.id,
    semester: opts.semester ?? 1,
    section: opts.section ?? "A",
  });

  return { userId, studentId: student.id, email };
}

export type TempStaff = {
  userId: string;
  facultyId: string;
  email: string;
};

export async function createStaff(
  db: SupabaseClient,
  opts: { role: "faculty" | "hod"; department: string },
): Promise<TempStaff> {
  const id = unique();
  const email = `${FIXTURE_PREFIX}-stf-${id}@hkbk.edu.in`;

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: `Zz!${id}Aa9`,
    email_confirm: true,
    user_metadata: { role: opts.role },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const userId = created.user.id;

  await db.from("users").update({ role: opts.role, status: "active" }).eq("id", userId);
  await db
    .from("user_roles")
    .upsert({ user_id: userId, role: opts.role }, { onConflict: "user_id,role" });

  const { data: faculty, error: fErr } = await db
    .from("faculty")
    .insert({
      user_id: userId,
      full_name: `RLS Staff ${id}`,
      employee_code: `${FIXTURE_PREFIX.toUpperCase()}${id}`,
      email,
      phone: `92${id}`,
      department_code: opts.department,
      designation: opts.role === "hod" ? "Professor and Head" : "Assistant Professor",
    })
    .select("id")
    .single();
  if (fErr) throw new Error(`faculty insert: ${fErr.message}`);

  return { userId, facultyId: faculty.id, email };
}

export async function createSubject(
  db: SupabaseClient,
  opts: { department: string; semester?: number },
): Promise<{ id: string; code: string }> {
  const id = unique();
  const code = `${FIXTURE_PREFIX.toUpperCase()}${id}`.slice(0, 20);

  const { data, error } = await db
    .from("vtu_subjects")
    .insert({
      department_code: opts.department,
      semester: opts.semester ?? 1,
      code,
      name: `RLS fixture subject ${id}`,
      scheme_year: 2022,
      official_url: "https://vtu.ac.in/",
    })
    .select("id, code")
    .single();
  if (error) throw new Error(`vtu_subjects insert: ${error.message}`);

  return data;
}

/**
 * Removes everything this suite created.
 *
 * Keyed off the fixture prefix rather than a list of ids, so a run that
 * crashed part-way still cleans up on the next one. Deleting the auth user
 * cascades to `users` and `students`; subjects cascade to their marks.
 */
export async function cleanupFixtures(db: SupabaseClient): Promise<void> {
  const { data: subjects } = await db
    .from("vtu_subjects")
    .select("id")
    .like("code", `${FIXTURE_PREFIX.toUpperCase()}%`);
  for (const subject of subjects ?? []) {
    await db.from("subject_faculty").delete().eq("subject_id", subject.id);
    await db.from("vtu_subjects").delete().eq("id", subject.id);
  }

  const { data: staff } = await db
    .from("faculty")
    .select("id, user_id")
    .like("email", `${FIXTURE_PREFIX}-%`);
  for (const person of staff ?? []) {
    await db.from("subject_faculty").delete().eq("faculty_id", person.id);
    await db.from("faculty_student_assignments").delete().eq("faculty_id", person.id);
    await db.from("faculty").delete().eq("id", person.id);
  }

  const { data: students } = await db
    .from("students")
    .select("id, user_id")
    .like("email", `${FIXTURE_PREFIX}-%`);
  for (const student of students ?? []) {
    await db.from("students").delete().eq("id", student.id);
  }

  for (const person of [...(staff ?? []), ...(students ?? [])]) {
    await db.from("user_roles").delete().eq("user_id", person.user_id);
    await db.auth.admin.deleteUser(person.user_id).catch(() => {
      // Already gone, or never created — either way there is nothing to do.
    });
  }
}
