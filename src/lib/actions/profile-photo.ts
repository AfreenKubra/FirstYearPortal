"use server";

import { revalidatePath } from "next/cache";
import { getOwnStudent } from "@/lib/queries/student";
import { createClient } from "@/lib/supabase/server";
import {
  profilePhotoExtension,
  validateProfilePhoto,
} from "@/lib/validation/profile-photo";
import type { ActionState } from "./form-state";

const BUCKET = "profile-photos";

export async function uploadProfilePhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await getOwnStudent();
  if (!student) {
    return { status: "error", message: "Your session has expired. Sign in again." };
  }

  const file = formData.get("profilePhoto");
  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a photo to upload." };
  }

  const problem = validateProfilePhoto(file);
  if (problem) return { status: "error", message: problem };

  const supabase = createClient();
  const path = `${student.id}/${Date.now()}.${profilePhotoExtension(file)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { status: "error", message: "Could not upload that photo. Try again." };
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({ profile_photo_url: path })
    .eq("id", student.id);

  if (updateError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { status: "error", message: "Could not save that photo. Try again." };
  }

  if (student.profilePhotoPath && student.profilePhotoPath !== path) {
    await supabase.storage.from(BUCKET).remove([student.profilePhotoPath]);
  }

  revalidatePath("/dashboard");
  revalidatePath("/complete-profile");
  return { status: "success", message: "Profile photo updated." };
}
