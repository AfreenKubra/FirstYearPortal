"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOwnAdmin } from "@/lib/queries/admin";
import { fieldErrorsFrom, type ActionState } from "./form-state";

/**
 * VTU scheme entry (PRD 5.9's honesty rule applied to the syllabus).
 *
 * Administrator-only, and the official URL is required rather than optional:
 * an unsourced subject list is exactly the fabricated metadata the resource
 * catalogue rules out, and this field is what makes a row checkable by
 * somebody who doubts it.
 */

const subjectSchema = z.object({
  departmentCode: z.string().trim().min(2, "Choose a department."),
  semester: z.coerce
    .number()
    .int()
    .min(1, "Semester 1 to 8.")
    .max(8, "Semester 1 to 8."),
  code: z.string().trim().min(2, "Enter the subject code.").max(20),
  name: z.string().trim().min(3, "Enter the subject name.").max(200),
  credits: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(30).nullable(),
  ),
  schemeYear: z.coerce
    .number()
    .int()
    .min(2000, "Enter the scheme year, e.g. 2022.")
    .max(2100),
  officialUrl: z
    .string()
    .trim()
    .url("Paste the official VTU page this came from.")
    .max(2000),
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(500).nullable(),
  ),
  domainIds: z.array(z.coerce.number().int().positive()),
});

export async function addVtuSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await getOwnAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const parsed = subjectSchema.safeParse({
    departmentCode: formData.get("departmentCode"),
    semester: formData.get("semester"),
    code: formData.get("code"),
    name: formData.get("name"),
    credits: formData.get("credits"),
    schemeYear: formData.get("schemeYear"),
    officialUrl: formData.get("officialUrl"),
    notes: formData.get("notes"),
    domainIds: formData.getAll("domainIds").map(Number),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const values = parsed.data;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("vtu_subjects")
    .insert({
      department_code: values.departmentCode,
      semester: values.semester,
      code: values.code.toUpperCase(),
      name: values.name,
      credits: values.credits,
      scheme_year: values.schemeYear,
      official_url: values.officialUrl,
      notes: values.notes,
      added_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    const message = /duplicate key|unique/i.test(error?.message ?? "")
      ? "That subject code already exists for this department and scheme year."
      : "Could not add that subject.";
    return { status: "error", message };
  }

  if (values.domainIds.length > 0) {
    await supabase.from("vtu_subject_domains").insert(
      values.domainIds.map((domain_id) => ({
        subject_id: data.id,
        domain_id,
      })),
    );
  }

  revalidatePath("/admin/vtu");
  return {
    status: "success",
    message: `${values.code.toUpperCase()} added. Student roadmaps in that department and semester will cite it from their next view.`,
  };
}

export async function setVtuSubjectActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await getOwnAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const id = String(formData.get("subjectId") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { status: "error", message: "Unknown subject." };

  const supabase = createClient();
  // Retired rather than deleted: roadmaps already generated cite it, and
  // removing the row would leave those plans referring to nothing.
  const { error } = await supabase
    .from("vtu_subjects")
    .update({ is_active: active })
    .eq("id", id);

  if (error) {
    return { status: "error", message: "Could not update that subject." };
  }

  revalidatePath("/admin/vtu");
  return {
    status: "success",
    message: active ? "Restored." : "Retired — new plans will not cite it.",
  };
}
