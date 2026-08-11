"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Select, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { LookupOption } from "@/lib/queries/student";
import { RESIDENCE_FIELD_LABEL, RESIDENCE_TYPES } from "@/config/residence";

/**
 * Combinable filters (PRD 5.5).
 *
 * State lives in the URL, not in component state: that makes any filtered
 * view linkable and shareable between faculty, survives a refresh, and means
 * the CSV export can be handed the exact same query string rather than
 * reimplementing the filter set.
 */
export function StudentFiltersPanel({
  departments,
  interests,
  goals,
  domains,
}: {
  departments: Array<{ code: string; name: string }>;
  interests: LookupOption[];
  goals: LookupOption[];
  domains: LookupOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const current = (key: string) => searchParams.get(key) ?? "";

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    // Array.from rather than iterating the FormData directly: TypeScript 5.6+
    // types `entries()` as an IteratorObject, which needs downlevelIteration
    // to spread. This is equivalent and avoids the compiler flag.
    for (const [key, value] of Array.from(formData.entries())) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    // Any filter change resets to page 1 — staying on page 7 of a result set
    // that now has two pages shows an empty table for no obvious reason.
    params.delete("page");
    router.push(`/faculty/students?${params.toString()}`);
  }

  return (
    <form
      action={apply}
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/faculty/students")}
        >
          Reset
        </Button>
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
