"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { staffRegistrationSchema } from "@/lib/validation/faculty";
import { fieldErrorsFrom, type ActionState } from "./form-state";

/**
 * Staff account requests — faculty and administrators (PRD 5.1, 5.5).
 *
 * Neither role is self-service. The `role` passed in user metadata is read by
 * the `handle_new_auth_user` trigger, which grants `status = 'pending'` to
 * anything that is not a student — so a caller cannot elevate themselves by
 * posting `role: 'admin'`. They get an inert pending account, and middleware
 * holds them on /pending-approval until an existing active admin approves it.
 *
 * The profile row (faculty or admins) is written by the requester themselves
 * under an insert-own RLS policy. Being in either table confers nothing on its
 * own; authority lives in `users.role` + `users.status`.
 */
export async function registerStaff(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = staffRegistrationSchema.safeParse({
    staffRole: formData.get("staffRole"),
    fullName: formData.get("fullName"),
    employeeCode: formData.get("employeeCode"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    departmentCode: formData.get("departmentCode") ?? undefined,
    designation: formData.get("designation"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

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
    options: {
      data: { role: values.staffRole, full_name: values.fullName },
    },
  });

  if (signUpError) {
    return { status: "error", message: signUpError.message };
  }
  if (!signUpData.session || !signUpData.user) {
    return {
      status: "error",
      message:
        "Account created, but email confirmation is enabled on this project, " +
        "so your staff record could not be created. Contact the portal " +
        "administrator.",
    };
  }

  const userId = signUpData.user.id;

  const { error: profileError } =
    values.staffRole === "faculty"
      ? await supabase.from("faculty").insert({
          user_id: userId,
          full_name: values.fullName,
          employee_code: values.employeeCode,
          email: values.email,
          phone: values.phone,
          department_code: values.departmentCode!,
          designation: values.designation,
        })
      : await supabase.from("admins").insert({
          user_id: userId,
          full_name: values.fullName,
          employee_code: values.employeeCode,
          email: values.email,
          designation: values.designation,
        });

  if (profileError) {
    const message = /duplicate key|unique/i.test(profileError.message)
      ? "That employee code, email, or phone number is already registered."
      : "Could not create your staff record. Contact the portal administrator.";
    return { status: "error", message };
  }

  redirect("/pending-approval");
}
