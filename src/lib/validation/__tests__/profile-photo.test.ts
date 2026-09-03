import { describe, expect, it } from "vitest";
import {
  PROFILE_PHOTO_MAX_BYTES,
  profilePhotoExtension,
  validateProfilePhoto,
} from "../profile-photo";

function file(size: number, type: string): File {
  return { size, type, name: "profile" } as File;
}

describe("validateProfilePhoto", () => {
  it("accepts the supported image formats", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateProfilePhoto(file(1000, type))).toBeNull();
    }
  });

  it("rejects empty, oversized, and non-image files", () => {
    expect(validateProfilePhoto(file(0, "image/jpeg"))).toMatch(/choose/i);
    expect(
      validateProfilePhoto(file(PROFILE_PHOTO_MAX_BYTES + 1, "image/jpeg")),
    ).toMatch(/5 MB/);
    expect(validateProfilePhoto(file(1000, "application/pdf"))).toMatch(/JPEG/);
  });
});

describe("profilePhotoExtension", () => {
  it("derives a safe extension from the verified MIME type", () => {
    expect(profilePhotoExtension(file(1000, "image/jpeg"))).toBe("jpg");
    expect(profilePhotoExtension(file(1000, "image/png"))).toBe("png");
    expect(profilePhotoExtension(file(1000, "image/webp"))).toBe("webp");
  });
});
