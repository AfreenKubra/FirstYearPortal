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
 * One schema for both staff roles (PRD 5.1).
 *
 * Department is required for faculty and optional for administrators — an
 * institution-wide admin does not belong to one department, and forcing an
 * arbitrary choice would corrupt the department analytics they are there to
 * read.
 */
export const staffRegistrationSchema = z
  .object({
    staffRole: z.enum(["faculty", "admin"], {
      errorMap: () => ({ message: "Choose faculty or administrator." }),
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
    (v) => (v.staffRole === "faculty" ? Boolean(v.departmentCode) : true),
    { path: ["departmentCode"], message: "Select your department." },
  );

export type StaffRegistrationValues = z.infer<typeof staffRegistrationSchema>;
