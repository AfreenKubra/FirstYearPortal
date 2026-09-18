"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { uploadProfilePhoto } from "@/lib/actions/profile-photo";
import { idleState } from "@/lib/actions/form-state";
import { useActionState } from "@/lib/actions/use-action-state";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { ProfileAvatar } from "./ProfileAvatar";

export function ProfilePhotoUpload({
  studentName,
  photoUrl,
}: {
  studentName: string;
  photoUrl: string | null;
}) {
  const [state, formAction] = useActionState(uploadProfilePhoto, idleState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function preview(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  const shownPhoto = previewUrl ?? photoUrl;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <ProfileAvatar studentName={studentName} photoUrl={shownPhoto} />

        <form action={formAction} className="min-w-0 flex-1 space-y-2">
          <label
            htmlFor="profile-photo"
            className="block text-sm font-medium text-indigo-950"
          >
            Choose a new photo
          </label>
          <input
            id="profile-photo"
            name="profilePhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={preview}
            aria-describedby="profile-photo-help"
            className="block w-full text-xs text-ink-muted file:mr-2 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-indigo-800 hover:file:bg-indigo-100"
            required
          />
          <p id="profile-photo-help" className="text-xs text-ink-faint">
            JPEG, PNG, or WebP · up to 5 MB
          </p>
          <SubmitButton size="sm" pendingLabel="Uploading…">
            Upload photo
          </SubmitButton>
        </form>
      </div>
      <div className="mt-2">
        <FormMessage state={state} />
      </div>
    </div>
  );
}
