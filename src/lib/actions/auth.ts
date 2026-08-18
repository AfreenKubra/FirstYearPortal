"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { branding } from "@/config/branding";
import { homeForRole } from "@/config/roles";
import { registrationSchema } from "@/lib/validation/student";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { fieldErrorsFrom, type ActionState } from "./form-state";

const CONSENT_TEXT =
  "I consent to HKBK College of Engineering collecting and processing my " +
  "academic, personal, and guardian details for the purpose of student " +
  "development, mentoring, and institutional reporting.";

/**
 * Student registration (ARCHITECTURE 6.1).
 *
 * Runs entirely server-side — the hardening pass the architecture doc
 * anticipates. `signUp` fires the `handle_new_auth_user` trigger, which
 * creates the shadow `users` row; the session that `signUp` returns is what
 * authorises the `students` insert, and RLS's
 * `with check (user_id = auth.uid())` is the thing actually enforcing that a
 * caller can only create their own record.
 */
export async function registerStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
    dob: formData.get("dob"),
    usn: formData.get("usn"),
    phone: formData.get("phone"),
    state: formData.get("state"),
    city: formData.get("city"),
    departmentCode: formData.get("departmentCode"),
    guardianName: formData.get("guardianName"),
    guardianPhone: formData.get("guardianPhone"),
    residenceType: formData.get("residenceType"),
    languageIds: formData.getAll("languageIds").map(Number),
    consent: formData.get("consent") === "on" || formData.get("consent") === "true",
  };

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const values = parsed.data;
  const supabase = createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: { data: { role: "student", username: values.username } },
  });

  if (signUpError) {
    return { status: "error", message: signUpError.message };
  }

  if (!signUpData.session) {
    // Happens when "Confirm email" is enabled in Supabase Auth. The student
    // row can't be written without a session, so say so plainly rather than
    // leaving a half-created account behind a generic error.
    return {
      status: "error",
      message:
        "Account created, but email confirmation is enabled on this project, " +
        "so your profile could not be set up automatically. Confirm your " +
        "email and contact the portal administrator.",
    };
  }

  const userId = signUpData.user!.id;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      user_id: userId,
      full_name: values.fullName,
      dob: values.dob,
      usn: values.usn,
      phone: values.phone,
      email: values.email,
      username: values.username,
      state: values.state,
      city: values.city,
      department_code: values.departmentCode,
      guardian_name: values.guardianName,
      guardian_phone: values.guardianPhone,
      residence_type: values.residenceType,
      consent_given_at: new Date().toISOString(),
      profile_completion_percent: 20, // identity section only
    })
    .select("id")
    .single();

  if (studentError || !student) {
    // Most likely a unique-constraint hit on USN/phone/username. Surface
    // which one rather than a generic failure.
    const message = /duplicate key|unique/i.test(studentError?.message ?? "")
      ? "That USN, phone number, or username is already registered."
      : "Could not create your student record. Please contact support.";
    return { status: "error", message };
  }

  if (values.languageIds.length > 0) {
    await supabase.from("student_languages").insert(
      values.languageIds.map((languageId) => ({
        student_id: student.id,
        language_id: languageId,
      })),
    );
  }

  await supabase.from("consent_records").insert({
    student_id: student.id,
    consent_type: "data_processing",
    consent_text: CONSENT_TEXT,
    granted: true,
  });

  // Since migration 0008 students also start 'pending', so middleware would
  // bounce them off /complete-profile anyway. Sending them straight to the
  // waiting page explains why, instead of showing an unexplained redirect.
  redirect("/pending-approval");
}

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    // Deliberately does not distinguish "no such account" from "wrong
    // password" — that difference tells an attacker which emails are
    // registered.
    return { status: "error", message: "Incorrect email or password." };
  }

  const { data: account } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", data.user.id)
    .single();

  // --- Portal restriction --------------------------------------------------
  //
  // A role-specific entrance (currently /login/hod) posts the role it serves.
  // The check is here rather than on the page because the page cannot enforce
  // anything: the field is a hidden input a caller can edit or delete. What
  // makes the restriction real is that the role is read back from the `users`
  // table and compared server-side, and a mismatch ends the session rather
  // than redirecting — otherwise the wrong-role visitor would walk away
  // holding valid credentials for a portal they were just refused.
  const portal = formData.get("portal");
  if (typeof portal === "string" && portal.length > 0) {
    // Membership, not equality: the head of a department is also an
    // administrator here, and `users.role` holds only their primary role.
    const { data: granted } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    const held = new Set<string>([
      ...(account ? [account.role] : []),
      ...(granted ?? []).map((row) => row.role),
    ]);

    if (!held.has(portal)) {
      await supabase.auth.signOut();
      return {
        status: "error",
        message:
          portal === "hod"
            ? "This entrance is for Head of Department accounts. Sign in from the main page instead."
            : "This account cannot sign in through this entrance.",
      };
    }
  }

  // Only an approved account gets a session.
  //
  // The credentials were correct, so Supabase has already issued one — it has
  // to be revoked explicitly. Merely redirecting a pending or declined user
  // would leave them holding a valid session and relying on middleware to
  // fence them in on every subsequent request; signing them out means there
  // is nothing to fence.
  if (!account || account.status !== "active") {
    await supabase.auth.signOut();

    const reason =
      account?.status === "pending"
        ? "Your account is waiting for a portal administrator to approve it. " +
          "You'll be able to sign in as soon as it's approved."
        : account?.status === "rejected"
          ? "This registration was not approved, so the account cannot be used."
          : account?.status === "suspended"
            ? "This account has been suspended and cannot be used."
            : "This account is not set up correctly. Contact the portal administrator.";

    return {
      status: "error",
      message: `${reason} If you think this is a mistake, contact ${branding.contacts.support}.`,
    };
  }

  // Last-login tracking (PRD 5.1) — recorded only for logins that actually
  // succeed, so the column means "last used" rather than "last attempted".
  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  revalidatePath("/", "layout");

  // Signing in through a role-specific entrance lands you in that role's
  // area, not your primary one. Someone who deliberately opened /login/hod
  // wants the department portal, even though their primary role sends them
  // to /admin every other time.
  const portalRole = typeof portal === "string" ? portal : null;
  redirect(homeForRole(portalRole ?? account.role));
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const origin = headers().get("origin") ?? "";
  const supabase = createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always reports success, whether or not the address exists — otherwise
  // this endpoint becomes a way to enumerate registered students.
  return {
    status: "success",
    message:
      "If that email is registered, a password reset link is on its way. " +
      "Check your inbox and spam folder.",
  };
}

export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "This reset link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  redirect("/dashboard");
}
