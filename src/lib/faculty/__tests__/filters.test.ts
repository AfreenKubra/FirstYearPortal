import { describe, expect, it } from "vitest";
import {
  csvCell,
  describeFilters,
  EMPTY_FILTERS,
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
  toCsv,
} from "../filters";

describe("parseFilters", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS);
  });

  it("parses a full set of filters", () => {
    const filters = parseFilters({
      q: "aisha",
      department: "CSE",
      semester: "1",
      section: "a",
      quota: "cet",
      residence: "pg",
      completion: "incomplete",
      interest: "3",
      goal: "2",
      domain: "7",
      minTenth: "85",
      minTwelfth: "90.5",
      page: "4",
    });

    expect(filters.q).toBe("aisha");
    expect(filters.department).toBe("CSE");
    expect(filters.semester).toBe(1);
    expect(filters.section).toBe("A");
    expect(filters.completion).toBe("incomplete");
    expect(filters.interestId).toBe(3);
    expect(filters.minTwelfth).toBe(90.5);
    expect(filters.page).toBe(4);
  });

  it("drops an unrecognised quota rather than passing it to the query", () => {
    expect(parseFilters({ quota: "'; drop table students; --" }).quota).toBeNull();
  });

  it("drops an unrecognised residence value", () => {
    expect(parseFilters({ residence: "mansion" }).residenceType).toBeNull();
  });

  it("accepts every valid residence type", () => {
    for (const value of ["hostel", "pg", "flat", "home"]) {
      expect(parseFilters({ residence: value }).residenceType).toBe(value);
    }
  });

  it("rejects an out-of-range semester", () => {
    expect(parseFilters({ semester: "7" }).semester).toBeNull();
    expect(parseFilters({ semester: "0" }).semester).toBeNull();
  });

  it("rejects percentages outside 0-100", () => {
    expect(parseFilters({ minTenth: "120" }).minTenth).toBeNull();
    expect(parseFilters({ minTenth: "-5" }).minTenth).toBeNull();
  });

  it("falls back to page 1 for a non-numeric page", () => {
    expect(parseFilters({ page: "abc" }).page).toBe(1);
    expect(parseFilters({ page: "0" }).page).toBe(1);
  });

  it("treats whitespace-only values as absent", () => {
    expect(parseFilters({ q: "   " }).q).toBeNull();
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseFilters({ department: ["CSE", "ECE"] }).department).toBe("CSE");
  });

  it("normalises an unknown completion band to 'all'", () => {
    expect(parseFilters({ completion: "nearly" }).completion).toBe("all");
  });
});

describe("hasActiveFilters", () => {
  it("is false for defaults", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("ignores pagination on its own", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, page: 5 })).toBe(false);
  });

  it("is true once any real filter is set", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, section: "A" })).toBe(true);
  });
});

describe("filtersToSearchParams", () => {
  it("omits defaults so the URL stays readable", () => {
    expect(filtersToSearchParams(EMPTY_FILTERS)).toBe("");
  });

  it("round-trips through parseFilters", () => {
    const original = parseFilters({
      q: "rahman",
      department: "AIML",
      semester: "2",
      completion: "complete",
      page: "3",
    });
    const query = filtersToSearchParams(original);
    const reparsed = parseFilters(
      Object.fromEntries(new URLSearchParams(query).entries()),
    );
    expect(reparsed).toEqual(original);
  });

  it("applies an override without mutating the source", () => {
    const filters = parseFilters({ department: "CSE", page: "2" });
    const query = filtersToSearchParams(filters, { page: 3 });
    expect(query).toContain("page=3");
    expect(filters.page).toBe(2);
  });
});

describe("describeFilters", () => {
  it("returns nothing when no filters are applied", () => {
    expect(describeFilters(EMPTY_FILTERS)).toEqual([]);
  });

  it("resolves lookup ids to names when a resolver is supplied", () => {
    const parts = describeFilters(
      { ...EMPTY_FILTERS, goalId: 4 },
      (_kind, id) => (id === 4 ? "Study abroad" : "?"),
    );
    expect(parts).toContain("Goal: Study abroad");
  });

  it("falls back to the raw id without a resolver", () => {
    expect(describeFilters({ ...EMPTY_FILTERS, goalId: 4 })).toContain("Goal: #4");
  });
});

describe("csvCell", () => {
  it("quotes values containing commas, quotes, or newlines", () => {
    expect(csvCell("Rahman, K")).toBe('"Rahman, K"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("neutralises formula injection in spreadsheet software", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+44 123")).toBe("'+44 123");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("renders null and undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("leaves ordinary values alone", () => {
    expect(csvCell("1HK24CS001")).toBe("1HK24CS001");
    expect(csvCell(92.4)).toBe("92.4");
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and cells with commas", () => {
    expect(
      toCsv([
        ["Name", "USN"],
        ["Aisha", "1HK24CS001"],
      ]),
    ).toBe("Name,USN\r\nAisha,1HK24CS001");
  });
});
