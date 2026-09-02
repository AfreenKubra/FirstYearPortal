"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOwnAdmin } from "@/lib/queries/admin";
import { getOwnStaff } from "@/lib/queries/faculty";
import { getOwnStudent } from "@/lib/queries/student";
import { RESOURCE_KIND_VALUES, costChoiceToIsFree } from "@/config/resources";
import { parseBulkResources } from "@/lib/resources/bulk";
import { fieldErrorsFrom, type ActionState } from "./form-state";

/**
 * Resource mutations (PRD 5.9).
 *
 * Faculty may suggest; only an administrator may verify. That split is
 * enforced by a trigger in migration 0015 as well as here, because "an
 * administrator has checked this link" is the one claim in the catalogue a
 * student is being asked to rely on.
 */

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable(),
  );

/**
 * A `<input type="date">` value, or nothing.
 *
 * Kept as the plain `YYYY-MM-DD` string the input produces rather than parsed
 * into a `Date`: the column is `date`, an empty field must mean "unknown" and
 * not "today", and a `Date` would drag a timezone into a value that has none.
 * Sorting and comparison work directly on the ISO string.
 */
const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
    .nullable(),
);

const resourceSchema = z.object({
  title: z.string().trim().min(3, "Give the resource a title.").max(200),
  description: optionalText(2000),
  kind: z.enum(RESOURCE_KIND_VALUES, {
    errorMap: () => ({ message: "Choose a resource type." }),
  }),
  provider: optionalText(120),
  // Checked here as well as by the database constraint so the person adding
  // it gets a sentence rather than a constraint violation. `http` is allowed
  // because some VTU-hosted documents are still served over it, and refusing
  // them would push people to paste the link somewhere worse.
  url: z
    .string()
    .trim()
    .url("Enter a full link, starting http:// or https://")
    .max(2000),
  departmentCode: optionalText(10),
  semester: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(1).max(2).nullable(),
  ),
  estimatedHours: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(2000).nullable(),
  ),
  // Three states, not two. A checkbox here used to collapse "nobody has
  // recorded this" into a confident "Paid" — and because the box defaulted to
  // checked, NULL was not even reachable through the form. Cost is a claim
  // about someone else's page, so the portal must be able to say it does not
  // know one.
  cost: z.enum(["free", "paid", "unknown"]).catch("unknown"),
  occursOn: optionalDate,
  registrationOpensOn: optionalDate,
  registrationClosesOn: optionalDate,
  interestIds: z.array(z.coerce.number().int().positive()),
  goalIds: z.array(z.coerce.number().int().positive()),
  domainIds: z.array(z.coerce.number().int().positive()),
})
  // Mirrors the `resource_dates_ordered` constraint added in migration 0023,
  // so a curator gets a sentence rather than a database error.
  .refine(
    (v) =>
      v.registrationOpensOn === null ||
      v.registrationClosesOn === null ||
      v.registrationOpensOn <= v.registrationClosesOn,
    {
      message: "Registration cannot close before it opens.",
      path: ["registrationClosesOn"],
    },
  )
  .refine(
    (v) =>
      v.registrationClosesOn === null ||
      v.occursOn === null ||
      v.registrationClosesOn <= v.occursOn,
    {
      message: "Registration cannot close after the date itself.",
      path: ["registrationClosesOn"],
    },
  );

function readForm(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    kind: formData.get("kind"),
    provider: formData.get("provider"),
    url: formData.get("url"),
    departmentCode: formData.get("departmentCode"),
    semester: formData.get("semester"),
    estimatedHours: formData.get("estimatedHours"),
    cost: formData.get("cost"),
    occursOn: formData.get("occursOn"),
    registrationOpensOn: formData.get("registrationOpensOn"),
    registrationClosesOn: formData.get("registrationClosesOn"),
    interestIds: formData.getAll("interestIds").map(Number),
    goalIds: formData.getAll("goalIds").map(Number),
    domainIds: formData.getAll("domainIds").map(Number),
  };
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function replaceTags(
  resourceId: string,
  values: {
    interestIds: number[];
    goalIds: number[];
    domainIds: number[];
  },
) {
  const supabase = createClient();

  // Replaced wholesale rather than diffed: the tag set is small, always
  // edited as a whole, and a partial update that drops one tag would quietly
  // change who the resource is recommended to.
  await Promise.all([
    supabase.from("resource_interests").delete().eq("resource_id", resourceId),
    supabase.from("resource_goals").delete().eq("resource_id", resourceId),
    supabase.from("resource_domains").delete().eq("resource_id", resourceId),
  ]);

  // PromiseLike, not Promise: postgrest-js query builders are thenable but
  // are not Promise instances, so they lack `catch` and `finally`.
  const inserts: Array<PromiseLike<unknown>> = [];
  if (values.interestIds.length > 0) {
    inserts.push(
      supabase.from("resource_interests").insert(
        values.interestIds.map((interest_id) => ({
          resource_id: resourceId,
          interest_id,
        })),
      ),
    );
  }
  if (values.goalIds.length > 0) {
    inserts.push(
      supabase.from("resource_goals").insert(
        values.goalIds.map((goal_id) => ({ resource_id: resourceId, goal_id })),
      ),
    );
  }
  if (values.domainIds.length > 0) {
    inserts.push(
      supabase.from("resource_domains").insert(
        values.domainIds.map((domain_id) => ({
          resource_id: resourceId,
          domain_id,
        })),
      ),
    );
  }

  await Promise.all(inserts);
}

export async function createResource(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const [staff, admin] = await Promise.all([getOwnStaff(), getOwnAdmin()]);
  if (!staff && !admin) {
    return { status: "error", message: "Staff access required." };
  }

  const parsed = resourceSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const values = parsed.data;
  const supabase = createClient();

  const { data, error } = await supabase
    .from("resources")
    .insert({
      title: values.title,
      description: values.description,
      kind: values.kind,
      provider: values.provider,
      url: values.url,
      department_code: values.departmentCode,
      semester: values.semester,
      estimated_hours: values.estimatedHours,
      is_free: costChoiceToIsFree(values.cost),
      occurs_on: values.occursOn,
      registration_opens_on: values.registrationOpensOn,
      registration_closes_on: values.registrationClosesOn,
      added_by: await currentUserId(),
    })
    .select("id")
    .single();

  if (error || !data) {
    const message = /duplicate key|unique/i.test(error?.message ?? "")
      ? "That link is already in the catalogue."
      : "Could not add that resource.";
    return { status: "error", message };
  }

  await replaceTags(data.id, values);

  revalidatePath("/admin/resources");
  revalidatePath("/resources");

  return {
    status: "success",
    message: admin
      ? "Added. Mark it verified once you have opened the link."
      : "Added, and shown to students as unverified until an administrator checks it.",
  };
}

/**
 * Adds many resources from one pasted block (PRD 5.9).
 *
 * The catalogue's real problem was never the form — it was that a domain needs
 * a dozen entries before its shelf is worth opening, and a dozen trips through
 * a twelve-field form is an afternoon. This is the same insert as
 * `createResource`, run per line, with the parsing in `@/lib/resources/bulk`.
 *
 * Three things it deliberately does not do:
 *
 *   - It does not verify anything. Every row lands unchecked, exactly as a
 *     single add does, and the trigger from 0015 enforces that regardless of
 *     what this action asks for. Bulk entry is a faster way to *suggest* links,
 *     not a way around the one claim students are asked to rely on.
 *   - It does not stop at the first bad line. Each line is independent, so a
 *     typo on line 9 does not discard the eight good rows above it — and the
 *     failures come back quoted, by line number, rather than as a count.
 *   - It does not create tags. A domain name that is not already an option is
 *     reported, because letting a typo become a permanent entry in every
 *     student's profile is a worse outcome than retyping a line.
 */
export async function createResourcesBulk(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await getOwnAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const text = String(formData.get("bulk") ?? "");
  if (text.trim() === "") {
    return { status: "error", message: "Paste at least one line." };
  }

  const supabase = createClient();
  const [domains, goals] = await Promise.all([
    supabase.from("technical_domains").select("id, name"),
    supabase.from("career_goals").select("id, name"),
  ]);

  const parsed = parseBulkResources(text, {
    kinds: RESOURCE_KIND_VALUES,
    domains: domains.data ?? [],
    goals: goals.data ?? [],
  });

  if (parsed.rows.length === 0) {
    return { status: "error", message: "Nothing to add — every line was blank." };
  }

  const userId = await currentUserId();
  const added: string[] = [];
  // Rejections carry their line number and reason. A curator told only "3
  // failed" has lost three resources and cannot tell which.
  const rejected = parsed.failed.map(
    (row) => `Line ${row.line}: ${row.errors.join(" ")}`,
  );

  for (const row of parsed.ok) {
    const values = row.values;
    if (!values) continue;

    const { data, error } = await supabase
      .from("resources")
      .insert({
        title: values.title,
        kind: values.kind,
        provider: values.provider,
        url: values.url,
        is_free: costChoiceToIsFree(values.cost),
        added_by: userId,
      })
      .select("id")
      .single();

    if (error || !data) {
      rejected.push(
        `Line ${row.line}: ${
          /duplicate key|unique/i.test(error?.message ?? "")
            ? "already in the catalogue."
            : "could not be added."
        }`,
      );
      continue;
    }

    await replaceTags(data.id, {
      interestIds: [],
      goalIds: values.goalIds,
      domainIds: values.domainIds,
    });
    added.push(values.title);
  }

  revalidatePath("/admin/resources");
  revalidatePath("/resources");

  if (added.length === 0) {
    return {
      status: "error",
      message: `Nothing was added. ${rejected.join(" ")}`,
    };
  }

  return {
    status: "success",
    message:
      `Added ${added.length} ${added.length === 1 ? "resource" : "resources"}, ` +
      `all unchecked until somebody opens the links.` +
      (rejected.length > 0 ? ` Skipped: ${rejected.join(" ")}` : ""),
  };
}

const verifySchema = z.object({
  resourceId: z.string().uuid("Unknown resource."),
  verified: z.boolean(),
});

/**
 * Marks a resource checked, or un-checks it.
 *
 * Administrator-only, in this action and again in the database. The badge
 * means "somebody accountable opened this link"; if anyone could set it, it
 * would mean nothing at all.
 */
export async function setResourceVerified(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await getOwnAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const parsed = verifySchema.safeParse({
    resourceId: formData.get("resourceId"),
    verified: formData.get("verified") === "true",
  });

  if (!parsed.success) {
    return { status: "error", message: "Could not update that resource." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("resources")
    .update({
      is_verified: parsed.data.verified,
      verified_by: parsed.data.verified ? admin.id : null,
      verified_at: parsed.data.verified ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.resourceId);

  if (error) {
    return { status: "error", message: "Could not update that resource." };
  }

  revalidatePath("/admin/resources");
  revalidatePath("/resources");

  return {
    status: "success",
    message: parsed.data.verified
      ? "Marked as checked."
      : "Verification removed — students will see it as unchecked.",
  };
}

export async function setResourceActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await getOwnAdmin();
  if (!admin) {
    return { status: "error", message: "Administrator access required." };
  }

  const resourceId = String(formData.get("resourceId") ?? "");
  const active = formData.get("active") === "true";
  if (!resourceId) return { status: "error", message: "Unknown resource." };

  const supabase = createClient();
  // Retired rather than deleted: a student may have saved it, and removing
  // the row would silently empty their list.
  const { error } = await supabase
    .from("resources")
    .update({ is_active: active })
    .eq("id", resourceId);

  if (error) {
    return { status: "error", message: "Could not update that resource." };
  }

  revalidatePath("/admin/resources");
  return {
    status: "success",
    message: active ? "Restored to the catalogue." : "Retired from the catalogue.",
  };
}

export async function toggleSavedResource(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Student access required." };
  }

  const resourceId = String(formData.get("resourceId") ?? "");
  const save = formData.get("save") === "true";
  if (!resourceId) return { status: "error", message: "Unknown resource." };

  const supabase = createClient();
  const { error } = save
    ? await supabase
        .from("student_resources")
        .upsert(
          { student_id: student.id, resource_id: resourceId },
          { onConflict: "student_id,resource_id" },
        )
    : await supabase
        .from("student_resources")
        .delete()
        .eq("student_id", student.id)
        .eq("resource_id", resourceId);

  if (error) {
    return { status: "error", message: "Could not update your saved list." };
  }

  revalidatePath("/resources");
  return {
    status: "success",
    message: save ? "Saved to your list." : "Removed from your list.",
  };
}
