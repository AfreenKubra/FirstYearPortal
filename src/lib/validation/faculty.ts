import { z } from "zod";
import { passwordSchema, phoneSchema } from "./student";

export const DESIGNATIONS = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Head of Department",
  "Lecturer",
  "Visiting Faculty",
] as const;

export const ADMIN_DESIGNATIONS = [
  "Portal Administrator",
  "Head of Department",
  "Dean",
  "Principal",
  "Registrar",
] as const;

/**
 * One schema for every staff role (PRD 5.1).
 *
 * Department is required for faculty and heads of department — both belong to
 * exactly one — and optional for administrators, who are institution-wide and
 * would corrupt the department analytics they exist to read if forced to pick
 * one.
 *
 * `admin` is still accepted here even though the registration form no longer
 * offers it: the schema's job is to describe what a valid request looks like,
 * and a hand-crafted POST asking for `admin` should fail the allow-list check
 * in the server action with a clear message, not fall out of schema parsing
 * as a malformed field.
 */
export const staffRegistrationSchema = z
  .object({
    staffRole: z.enum(["faculty", "hod", "admin"], {
      errorMap: () => ({ message: "Choose faculty or head of department." }),
    }),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    employeeCode: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Enter your employee code.")
      .max(20, "That employee code is too long."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    phone: phoneSchema,
    departmentCode: z.string().trim().optional(),
    designation: z.string().trim().min(2, "Select your designation."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })
  .refine(
    (v) => (v.staffRole === "admin" ? true : Boolean(v.departmentCode)),
    { path: ["departmentCode"], message: "Select your department." },
  );

export type StaffRegistrationValues = z.infer<typeof staffRegistrationSchema>;
