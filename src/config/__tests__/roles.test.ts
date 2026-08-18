import { describe, expect, it } from "vitest";
import {
  ADMIN_ALLOWLIST,
  ROLES,
  ROLE_HOME,
  ROLE_LABELS,
  ROLE_PREFIXES,
  STAFF_ROLE_CHOICES,
  homeForRole,
  isAllowlistedAdmin,
  isRole,
  mergeRoles,
  roleLabel,
} from "../roles";

describe("role table completeness", () => {
  // These three are the redirect-loop guard. Middleware sends an account to
  // ROLE_HOME[role]; if a role were missing an entry it would fall back to
  // /dashboard, which a non-student is then bounced off, back to the
  // fallback, forever.
  it("gives every role a home route", () => {
    for (const role of ROLES) {
      expect(ROLE_HOME[role], `no home route for ${role}`).toBeTruthy();
      expect(ROLE_HOME[role].startsWith("/")).toBe(true);
    }
  });

  it("gives every role a label", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role], `no label for ${role}`).toBeTruthy();
    }
  });

  it("only maps path prefixes to real roles", () => {
    for (const entry of ROLE_PREFIXES) {
      expect(isRole(entry.role), `${entry.role} is not a role`).toBe(true);
      expect(entry.prefix.startsWith("/")).toBe(true);
    }
  });

  it("covers every role's home route with a prefix rule", () => {
    // A home route with no prefix rule is a page no cross-role check guards.
    for (const role of ROLES) {
      const home = ROLE_HOME[role];
      const covering = ROLE_PREFIXES.find((entry) => home.startsWith(entry.prefix));
      expect(covering, `${home} is not covered by any prefix rule`).toBeDefined();
      expect(covering?.role).toBe(role);
    }
  });

  it("does not let one role's prefix shadow another's home", () => {
    for (const role of ROLES) {
      const home = ROLE_HOME[role];
      const first = ROLE_PREFIXES.find((entry) => home.startsWith(entry.prefix));
      expect(first?.role, `${home} resolves to ${first?.role}, not ${role}`).toBe(
        role,
      );
    }
  });
});

describe("isRole", () => {
  it("accepts every declared role", () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isRole("superuser")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(7)).toBe(false);
  });
});

describe("homeForRole", () => {
  it("routes each role to its own area", () => {
    expect(homeForRole("student")).toBe("/dashboard");
    expect(homeForRole("faculty")).toBe("/faculty");
    expect(homeForRole("hod")).toBe("/hod");
    expect(homeForRole("admin")).toBe("/admin");
  });

  it("falls back to the student dashboard for an unknown role", () => {
    // Fails closed: the least-privileged area, never a staff one.
    expect(homeForRole("root")).toBe("/dashboard");
    expect(homeForRole(null)).toBe("/dashboard");
  });
});

describe("roleLabel", () => {
  it("names the roles in the words the interface uses", () => {
    expect(roleLabel("hod")).toBe("Head of Department");
    expect(roleLabel("admin")).toBe("Administrator");
  });

  it("passes through an unknown value rather than inventing one", () => {
    expect(roleLabel("registrar")).toBe("registrar");
    expect(roleLabel(null)).toBe("—");
  });
});

describe("isAllowlistedAdmin", () => {
  it("accepts exactly the two approved addresses", () => {
    expect(isAllowlistedAdmin("hod.aiml@hkbk.edu.in")).toBe(true);
    expect(isAllowlistedAdmin("afreenk.aiml@hkbk.edu.in")).toBe(true);
    expect(ADMIN_ALLOWLIST).toHaveLength(2);
  });

  it("ignores case and surrounding whitespace", () => {
    // Supabase lowercases the stored address, but a form post or a hand-run
    // SQL statement may not have.
    expect(isAllowlistedAdmin("HOD.AIML@HKBK.EDU.IN")).toBe(true);
    expect(isAllowlistedAdmin("  afreenk.aiml@hkbk.edu.in  ")).toBe(true);
  });

  it("refuses everyone else", () => {
    expect(isAllowlistedAdmin("someone@hkbk.edu.in")).toBe(false);
    expect(isAllowlistedAdmin("")).toBe(false);
    expect(isAllowlistedAdmin(null)).toBe(false);
    expect(isAllowlistedAdmin(undefined)).toBe(false);
  });

  it("does not match on a substring or a lookalike domain", () => {
    expect(isAllowlistedAdmin("xhod.aiml@hkbk.edu.in")).toBe(false);
    expect(isAllowlistedAdmin("hod.aiml@hkbk.edu.in.evil.com")).toBe(false);
    expect(isAllowlistedAdmin("hod.aiml@hkbk-edu.in")).toBe(false);
  });
});

describe("mergeRoles", () => {
  it("combines the primary role with the granted ones", () => {
    expect(mergeRoles("admin", [{ role: "hod" }]).sort()).toEqual([
      "admin",
      "hod",
    ]);
  });

  it("always includes the primary role, even if user_roles is empty", () => {
    // The account's home route is derived from the primary role. If that role
    // were missing from the set, middleware would refuse the very page it
    // redirects to — a loop the user experiences as a dead tab.
    expect(mergeRoles("admin", [])).toEqual(["admin"]);
    expect(mergeRoles("faculty", null)).toEqual(["faculty"]);
    expect(mergeRoles("hod", undefined)).toEqual(["hod"]);
  });

  it("does not duplicate a primary role that is also granted", () => {
    expect(mergeRoles("hod", [{ role: "hod" }])).toEqual(["hod"]);
  });

  it("drops roles the application does not recognise", () => {
    // These values decide route access. An unknown role must not be treated
    // as a known one just because the database happened to contain it.
    expect(mergeRoles("admin", [{ role: "superuser" }])).toEqual(["admin"]);
    expect(mergeRoles("admin", [{ role: "" }])).toEqual(["admin"]);
  });

  it("returns an empty set when the primary role is unrecognised", () => {
    // Fails closed: no roles means no area is entered, rather than defaulting
    // into one.
    expect(mergeRoles("root", [])).toEqual([]);
    expect(mergeRoles(null, null)).toEqual([]);
  });

  it("keeps valid granted roles when the primary is unrecognised", () => {
    expect(mergeRoles("root", [{ role: "faculty" }])).toEqual(["faculty"]);
  });

  it("handles the real two-role accounts", () => {
    // The head of AIML is also an administrator; the administrator also
    // teaches. Both land on /admin and can reach their second portal.
    const head = mergeRoles("admin", [{ role: "admin" }, { role: "hod" }]);
    expect(head).toHaveLength(2);
    expect(head).toContain("admin");
    expect(head).toContain("hod");

    const teacher = mergeRoles("admin", [
      { role: "admin" },
      { role: "faculty" },
    ]);
    expect(teacher).toHaveLength(2);
    expect(teacher).toContain("faculty");
  });
});

describe("staff registration choices", () => {
  it("offers only real roles", () => {
    for (const choice of STAFF_ROLE_CHOICES) {
      expect(isRole(choice.value)).toBe(true);
      expect(choice.label).toBeTruthy();
      expect(choice.hint).toBeTruthy();
    }
  });

  it("never offers administrator", () => {
    // Administrator is allow-list-only; offering it would be offering
    // something nearly every visitor would be refused.
    expect(STAFF_ROLE_CHOICES.map((c) => c.value)).not.toContain("admin");
  });

  it("never offers student", () => {
    // Students register at /register, not through the staff form.
    expect(STAFF_ROLE_CHOICES.map((c) => c.value)).not.toContain("student");
  });
});
