import { describe, expect, it } from "vitest";
import {
  achievementSchema,
  safeFileName,
  validateEvidenceFile,
  verificationSchema,
} from "../achievement";
import { EVIDENCE_MAX_BYTES } from "@/config/achievements";

function base(overrides: Record<string, unknown> = {}) {
  return {
    category: "sports",
    title: "Runner-up, VTU Zonal Football Tournament",
    level: "state",
    achievedOn: "2026-03-14",
    ...overrides,
  };
}

describe("achievementSchema", () => {
  it("accepts a well-formed achievement", () => {
    expect(achievementSchema.safeParse(base()).success).toBe(true);
  });

  it("normalises empty optional text to null rather than an empty string", () => {
    const result = achievementSchema.safeParse(
      base({ description: "", organisation: "   " }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
      expect(result.data.organisation).toBeNull();
    }
  });

  it("rejects a title shorter than 3 characters", () => {
    expect(achievementSchema.safeParse(base({ title: "ab" })).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      achievementSchema.safeParse(base({ category: "wizardry" })).success,
    ).toBe(false);
  });

  it("rejects an unknown level", () => {
    expect(achievementSchema.safeParse(base({ level: "galactic" })).success).toBe(
      false,
    );
  });

  it("rejects a date in the future", () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const future = nextYear.toISOString().slice(0, 10);
    expect(achievementSchema.safeParse(base({ achievedOn: future })).success).toBe(
      false,
    );
  });

  it("accepts today, so a certificate dated today is not rejected by timezone drift", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(achievementSchema.safeParse(base({ achievedOn: today })).success).toBe(
      true,
    );
  });

  it("rejects a malformed date", () => {
    expect(
      achievementSchema.safeParse(base({ achievedOn: "14-03-2026" })).success,
    ).toBe(false);
  });
});

describe("verificationSchema", () => {
  const id = "3f1a7c5e-1111-4222-8333-444455556666";

  it("accepts a verify decision without remarks", () => {
    const result = verificationSchema.safeParse({
      achievementId: id,
      decision: "verified",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.remarks).toBeNull();
  });

  it("rejects an unknown decision", () => {
    expect(
      verificationSchema.safeParse({ achievementId: id, decision: "maybe" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-uuid achievement id", () => {
    expect(
      verificationSchema.safeParse({ achievementId: "42", decision: "verified" })
        .success,
    ).toBe(false);
  });
});

describe("validateEvidenceFile", () => {
  function file(size: number, type: string, name = "cert.pdf"): File {
    // Constructing a real File would allocate `size` bytes; the validator only
    // reads .size/.type/.name, so a shaped stand-in is both valid and cheap.
    return { size, type, name } as File;
  }

  it("accepts a normal PDF", () => {
    expect(validateEvidenceFile(file(200_000, "application/pdf"))).toBeNull();
  });

  it("accepts each allowed image type", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateEvidenceFile(file(1000, type))).toBeNull();
    }
  });

  it("rejects an empty file", () => {
    expect(validateEvidenceFile(file(0, "application/pdf"))).toMatch(/empty/i);
  });

  it("rejects a file over the bucket limit", () => {
    expect(
      validateEvidenceFile(file(EVIDENCE_MAX_BYTES + 1, "application/pdf")),
    ).toMatch(/5 MB/);
  });

  it("accepts a file exactly at the limit", () => {
    expect(
      validateEvidenceFile(file(EVIDENCE_MAX_BYTES, "application/pdf")),
    ).toBeNull();
  });

  it("rejects a disallowed type", () => {
    expect(validateEvidenceFile(file(1000, "application/zip"))).toMatch(
      /JPEG, PNG, WebP, or PDF/,
    );
  });
});

describe("safeFileName", () => {
  it("strips path separators so a name cannot change its storage folder", () => {
    // The storage RLS policies parse the first path segment to decide access,
    // so a slash here would be a privilege-escalation vector.
    expect(safeFileName("../../other-student/evidence.pdf")).not.toContain("/");
    expect(safeFileName("a/b/c.pdf")).not.toContain("/");
  });

  it("keeps ordinary names readable", () => {
    expect(safeFileName("NPTEL-certificate_2026.pdf")).toBe(
      "NPTEL-certificate_2026.pdf",
    );
  });

  it("collapses runs of unsafe characters", () => {
    expect(safeFileName("my  weird***name.png")).toBe("my_weird_name.png");
  });

  it("never returns an empty string", () => {
    expect(safeFileName("***")).toBe("evidence");
    expect(safeFileName("")).toBe("evidence");
  });

  it("caps very long names", () => {
    expect(safeFileName("x".repeat(400)).length).toBeLessThanOrEqual(120);
  });
});
