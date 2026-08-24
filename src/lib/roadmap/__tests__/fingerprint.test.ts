import { describe, expect, it } from "vitest";
import { fingerprintInputs, isStale } from "../fingerprint";
import { generateRoadmap, type RoadmapInput } from "../generate";

const base: RoadmapInput = {
  departmentName: "Artificial Intelligence & Machine Learning",
  semester: 1,
  goals: ["IT / Software employment"],
  domains: ["Artificial Intelligence & ML"],
  interests: ["Programming"],
  tenthPercentage: 85,
  twelfthPercentage: 80,
  verifiedAchievements: 0,
};

describe("fingerprintInputs", () => {
  it("is stable for the same profile", () => {
    expect(fingerprintInputs(base)).toBe(fingerprintInputs({ ...base }));
  });

  it("ignores the order ids come back in", () => {
    // Postgres does not guarantee row order without ORDER BY. Without the
    // sort, a plan would be rewritten on nearly every page view.
    const a = { ...base, domains: ["A", "B", "C"] };
    const b = { ...base, domains: ["C", "A", "B"] };
    expect(fingerprintInputs(a)).toBe(fingerprintInputs(b));
  });

  it("changes when a goal changes", () => {
    expect(fingerprintInputs({ ...base, goals: ["Study abroad (MS / MEng)"] }))
      .not.toBe(fingerprintInputs(base));
  });

  it("changes when a domain is added", () => {
    expect(
      fingerprintInputs({ ...base, domains: [...base.domains, "Cybersecurity"] }),
    ).not.toBe(fingerprintInputs(base));
  });

  it("ignores a trivial change in marks", () => {
    // 78.4 becoming 78.40 is not worth rewriting somebody's plan over.
    expect(fingerprintInputs({ ...base, tenthPercentage: 85.4 })).toBe(
      fingerprintInputs({ ...base, tenthPercentage: 85 }),
    );
  });

  it("notices a real change in marks", () => {
    expect(fingerprintInputs({ ...base, tenthPercentage: 55 })).not.toBe(
      fingerprintInputs(base),
    );
  });

  it("buckets achievements rather than counting them", () => {
    // Going from none to some changes the advice. Going from three to four
    // does not.
    expect(fingerprintInputs({ ...base, verifiedAchievements: 3 })).toBe(
      fingerprintInputs({ ...base, verifiedAchievements: 4 }),
    );
    expect(fingerprintInputs({ ...base, verifiedAchievements: 1 })).not.toBe(
      fingerprintInputs({ ...base, verifiedAchievements: 0 }),
    );
  });

  it("changes when the recorded VTU scheme changes", () => {
    expect(fingerprintInputs({ ...base, vtuSubjects: ["BMATS101"] })).not.toBe(
      fingerprintInputs(base),
    );
  });

  it("treats an absent scheme and an empty one the same", () => {
    expect(fingerprintInputs({ ...base, vtuSubjects: [] })).toBe(
      fingerprintInputs(base),
    );
  });
});

describe("isStale", () => {
  it("is false when nothing has moved", () => {
    expect(isStale(fingerprintInputs(base), base)).toBe(false);
  });

  it("is true after a profile change", () => {
    const stored = fingerprintInputs(base);
    expect(isStale(stored, { ...base, goals: ["Entrepreneurship / Startup"] })).toBe(true);
  });

  it("treats a roadmap with no fingerprint as stale", () => {
    // Plans written before fingerprinting existed. Regenerating once is the
    // right outcome: a plan of unknown provenance is exactly what should be
    // refreshed.
    expect(isStale(null, base)).toBe(true);
  });
});

describe("generateRoadmap — VTU subjects", () => {
  it("says nothing about the syllabus when none is recorded", () => {
    // The portal does not scrape vtu.ac.in and must not invent subjects, so
    // with no scheme on file it stays silent rather than generalising.
    const plan = generateRoadmap(base);
    const text = plan.milestones.map((m) => `${m.title} ${m.detail ?? ""}`).join(" ");
    expect(text).not.toMatch(/scheme|syllabus|subject/i);
  });

  it("cites the subjects an administrator entered", () => {
    const plan = generateRoadmap({
      ...base,
      vtuSubjects: ["Mathematics-I", "Applied Physics", "Programming in C"],
    });
    const text = plan.milestones.map((m) => `${m.title} ${m.detail ?? ""}`).join(" ");
    expect(text).toContain("Mathematics-I");
    expect(text).toContain("Applied Physics");
  });

  it("never names a subject that was not supplied", () => {
    const plan = generateRoadmap({ ...base, vtuSubjects: ["Mathematics-I"] });
    const text = plan.milestones.map((m) => `${m.title} ${m.detail ?? ""}`).join(" ");
    // A generator that pads a short list with plausible-sounding subjects is
    // the exact failure this design exists to prevent.
    for (const invented of ["BMATS101", "Engineering Chemistry", "Elements of Civil"]) {
      expect(text).not.toContain(invented);
    }
  });

  it("attributes them to the recorded scheme, not to itself", () => {
    const plan = generateRoadmap({ ...base, vtuSubjects: ["Mathematics-I"] });
    const cited = plan.milestones.find((m) => /VTU scheme recorded/i.test(m.rationale));
    expect(cited).toBeDefined();
  });

  it("records in the summary when no scheme is on file", () => {
    expect(generateRoadmap(base).inputsSummary).toContain("none recorded");
  });
});
