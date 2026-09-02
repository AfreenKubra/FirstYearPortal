import { describe, expect, it } from "vitest";
import {
  COST_OPTIONS,
  costChoiceToIsFree,
  costLabel,
  isFreeToCostChoice,
} from "../resources";

/**
 * Regression guard for a shipped bug.
 *
 * `resources.is_free` has always been a *nullable* boolean — three states, by
 * design, where NULL means "nobody has recorded this". The form read it as
 * `formData.get("isFree") === "on"` from a checkbox that defaulted to checked,
 * which did not merely collapse the third state: it made NULL unreachable, and
 * every unticked box asserted **Paid** about a page nobody had priced.
 *
 * Cost is a claim about somebody else's site. The portal marks unverified
 * links precisely because it will not stand behind claims it has not checked,
 * and a fabricated price is the same failure applied to a different column.
 *
 * So the assertions below are deliberately blunt: null must never render as
 * "Paid", and the round trip through the form value must preserve all three
 * states. Two states are easy to fall back into by accident.
 */
describe("costLabel", () => {
  it("labels a free resource", () => {
    expect(costLabel(true)).toEqual({ label: "Free", tone: "free" });
  });

  it("labels a paid resource", () => {
    expect(costLabel(false)).toEqual({ label: "Paid", tone: "paid" });
  });

  it("says the cost is not recorded when nobody has recorded it", () => {
    expect(costLabel(null)).toEqual({
      label: "Cost not recorded",
      tone: "unknown",
    });
  });

  it("never renders an unrecorded cost as Paid — the bug this guards", () => {
    expect(costLabel(null).label).not.toBe("Paid");
    expect(costLabel(null).label).not.toBe("Free");
    expect(costLabel(undefined).label).not.toBe("Paid");
  });

  it("treats undefined like null rather than defaulting to a price", () => {
    expect(costLabel(undefined)).toEqual(costLabel(null));
  });
});

describe("cost form values", () => {
  it("maps every option to a distinct column value", () => {
    expect(costChoiceToIsFree("free")).toBe(true);
    expect(costChoiceToIsFree("paid")).toBe(false);
    expect(costChoiceToIsFree("unknown")).toBeNull();
  });

  it("maps unknown to NULL, not false", () => {
    // The precise shape of the original bug: `null` and `false` are both
    // falsy, so an assertion on truthiness would have passed throughout.
    expect(costChoiceToIsFree("unknown")).not.toBe(false);
  });

  it("round-trips all three states through the form and back", () => {
    for (const value of [true, false, null] as const) {
      expect(costChoiceToIsFree(isFreeToCostChoice(value))).toBe(value);
    }
  });

  it("defaults an unrecorded cost to the 'not recorded' option", () => {
    expect(isFreeToCostChoice(null)).toBe("unknown");
    expect(isFreeToCostChoice(undefined)).toBe("unknown");
  });

  it("offers 'not recorded' first, so the form's default asserts nothing", () => {
    expect(COST_OPTIONS[0].value).toBe("unknown");
  });

  it("has exactly one option per state", () => {
    expect(COST_OPTIONS).toHaveLength(3);
    expect(new Set(COST_OPTIONS.map((o) => o.value)).size).toBe(3);
  });
});
