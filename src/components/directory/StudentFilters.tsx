"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Select, TextInput } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { LookupOption } from "@/lib/queries/student";
import { RESIDENCE_FIELD_LABEL, RESIDENCE_TYPES } from "@/config/residence";

/**
 * Combinable filters (PRD 5.5), shared by the faculty, HOD, and admin
 * directories — only `basePath` differs.
 *
 * State lives in the URL, not in component state: that makes any filtered
 * view linkable and shareable, survives a refresh, and lets the CSV export
 * and the charts be handed the exact same query string rather than
 * reimplementing the filter set.
 *
 * The element is a real `method="get"` form pointed at `basePath`, so
 * submitting it filters correctly even with no client JavaScript running at
 * all. `onSubmit` then improves on that: it drops the empty fields a native
 * submission would send, resets the page number, and navigates client-side.
 * Filtering must not be one of the things that quietly stops working when a
 * script fails to load.
 */
export function StudentFiltersPanel({
  basePath,
  departments,
  interests,
  goals,
  domains,
}: {
  basePath: string;
  departments: Array<{ code: string; name: string }>;
  interests: LookupOption[];
  goals: LookupOption[];
  domains: LookupOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(() => hasAdvancedFilter(searchParams));

  const current = (key: string) => searchParams.get(key) ?? "";

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();

    // Array.from rather than iterating the FormData directly: TypeScript 5.6+
    // types `entries()` as an IteratorObject, which needs downlevelIteration
    // to spread. This is equivalent and avoids the compiler flag.
    for (const [key, value] of Array.from(new FormData(event.currentTarget).entries())) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }

    // Any filter change resets to page 1 — staying on page 7 of a result set
    // that now has two pages shows an empty table for no obvious reason.
    params.delete("page");

    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <form
      method="get"
      action={basePath}
      onSubmit={apply}
      className="rounded-card border border-indigo-100 bg-white shadow-card"
    >
      <div className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[14rem] flex-1">
          <TextInput
            label="Search"
            name="q"
            defaultValue={current("q")}
            placeholder="Name, USN, or email"
          />
        </div>
        <Button type="submit">Apply</Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="advanced-filters"
        >
          {open ? "Fewer filters" : "More filters"}
        </Button>
        {/* A link, not a button: resetting is a navigation, and this way it
            still works with scripting unavailable. */}
        <ButtonLink href={basePath} variant="ghost">
          Reset
        </ButtonLink>
      </div>

      <div
        id="advanced-filters"
        hidden={!open}
        className="grid gap-4 border-t border-indigo-100 p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Select
          label="Department"
          name="department"
          placeholder="Any department"
          defaultValue={current("department")}
          options={departments.map((d) => ({ value: d.code, label: d.name }))}
        />
        <Select
          label="Semester"
          name="semester"
          placeholder="Any semester"
          defaultValue={current("semester")}
          options={[
            { value: 1, label: "Semester 1" },
            { value: 2, label: "Semester 2" },
          ]}
        />
        <TextInput
          label="Section"
          name="section"
          className="uppercase"
          maxLength={4}
          defaultValue={current("section")}
          placeholder="Any"
        />
        <Select
          label="Admission quota"
          name="quota"
          placeholder="Any quota"
          defaultValue={current("quota")}
          options={[
            { value: "cet", label: "KCET" },
            { value: "comedk", label: "COMEDK" },
            { value: "jee", label: "JEE / Central" },
            { value: "management", label: "Management" },
            { value: "diploma_lateral", label: "Diploma lateral" },
            { value: "other", label: "Other" },
          ]}
        />
        <Select
          label={RESIDENCE_FIELD_LABEL}
          name="residence"
          placeholder="Any"
          defaultValue={current("residence")}
          options={RESIDENCE_TYPES.map((r) => ({
            value: r.value,
            label: r.label,
          }))}
        />
        <Select
          label="Profile status"
          name="completion"
          placeholder="Any status"
          defaultValue={current("completion")}
          options={[
            { value: "complete", label: "100% complete" },
            { value: "incomplete", label: "Incomplete" },
          ]}
        />
        <Select
          label="Area of interest"
          name="interest"
          placeholder="Any interest"
          defaultValue={current("interest")}
          options={interests.map((i) => ({ value: i.id, label: i.name }))}
        />
        <Select
          label="Career goal"
          name="goal"
          placeholder="Any goal"
          defaultValue={current("goal")}
          options={goals.map((g) => ({ value: g.id, label: g.name }))}
        />
        <Select
          label="Technical domain"
          name="domain"
          placeholder="Any domain"
          defaultValue={current("domain")}
          options={domains.map((d) => ({ value: d.id, label: d.name }))}
        />
        <TextInput
          label="Minimum 10th %"
          name="minTenth"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={current("minTenth")}
        />
        <TextInput
          label="Minimum 12th %"
          name="minTwelfth"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={current("minTwelfth")}
        />
      </div>
    </form>
  );
}

const ADVANCED_KEYS = [
  "department",
  "semester",
  "section",
  "quota",
  "residence",
  "completion",
  "interest",
  "goal",
  "domain",
  "minTenth",
  "minTwelfth",
];

/**
 * Opens the advanced panel on load when one of its fields is already active.
 * Landing on a shared link with four filters applied and a collapsed panel
 * that says "More filters" reads as though nothing is filtered.
 */
function hasAdvancedFilter(params: URLSearchParams): boolean {
  return ADVANCED_KEYS.some((key) => (params.get(key) ?? "") !== "");
}
