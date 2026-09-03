export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const PROFILE_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const EXTENSION_BY_TYPE: Record<(typeof PROFILE_PHOTO_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateProfilePhoto(file: File): string | null {
  if (file.size === 0) return "Choose a photo to upload.";
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return "That photo is larger than 5 MB. Choose a smaller image.";
  }
  if (!(PROFILE_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "Upload a JPEG, PNG, or WebP image.";
  }
  return null;
}

export function profilePhotoExtension(file: File): string {
  return EXTENSION_BY_TYPE[file.type as keyof typeof EXTENSION_BY_TYPE] ?? "jpg";
}
