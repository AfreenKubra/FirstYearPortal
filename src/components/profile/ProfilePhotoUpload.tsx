"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useFormState } from "react-dom";
import { uploadProfilePhoto } from "@/lib/actions/profile-photo";
import { idleState } from "@/lib/actions/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProfilePhotoUpload({
  studentName,
  photoUrl,
}: {
  studentName: string;
  photoUrl: string | null;
}) {
  const [state, formAction] = useFormState(uploadProfilePhoto, idleState);
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
    <div className="w-full rounded-xl border border-indigo-100 bg-white p-3 shadow-sm sm:w-auto sm:min-w-[19rem]">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-indigo-100 text-lg font-semibold text-indigo-800 shadow ring-1 ring-indigo-200">
          {shownPhoto ? (
            // Signed storage URLs are dynamic, so the native image element is
            // intentional here rather than a build-time configured host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownPhoto}
              alt={`${studentName}'s profile`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials(studentName) || "S"}</span>
          )}
        </div>

        <form action={formAction} className="min-w-0 flex-1 space-y-2">
          <label
            htmlFor="profile-photo"
            className="block text-sm font-medium text-indigo-950"
          >
            Profile picture
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
