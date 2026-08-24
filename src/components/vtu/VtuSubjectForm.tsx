"use client";

import { useFormState } from "react-dom";
import { addVtuSubject, setVtuSubjectActive } from "@/lib/actions/vtu";
import { idleState } from "@/lib/actions/form-state";
import { CheckboxGroup, Select, TextInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import type { LookupOption } from "@/lib/queries/student";

/**
 * Entering one VTU subject.
 *
 * The official URL is a required field, and the hint says why: this is the
 * portal's only claim about the syllabus, and a student reading their roadmap
 * should be able to check where it came from. Tagging to domains is what lets
 * a plan say "this subject feeds a domain you chose" rather than listing
 * subjects generically.
 */
export function VtuSubjectForm({
  departments,
  domains,
}: {
  departments: Array<{ code: string; name: string }>;
  domains: LookupOption[];
}) {
  const [state, formAction] = useFormState(addVtuSubject, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Department"
          name="departmentCode"
          placeholder="Choose a department"
          options={departments.map((d) => ({ value: d.code, label: d.name }))}
          error={errors.departmentCode}
        />
        <Select
          label="Semester"
          name="semester"
          placeholder="Choose a semester"
          options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
            value: n,
            label: `Semester ${n}`,
          }))}
          error={errors.semester}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput
          label="Subject code"
          name="code"
          className="uppercase"
          maxLength={20}
          placeholder="BMATS101"
          error={errors.code}
        />
        <TextInput
          label="Credits"
          name="credits"
          type="number"
          min={0}
          max={30}
          placeholder="Optional"
          error={errors.credits}
        />
        <TextInput
          label="Scheme year"
          name="schemeYear"
          type="number"
          min={2000}
          max={2100}
          placeholder="2022"
          hint="VTU revises periodically; both can coexist."
          error={errors.schemeYear}
        />
      </div>

      <TextInput
        label="Subject name"
        name="name"
        maxLength={200}
        placeholder="Mathematics for CSE stream-I"
        error={errors.name}
      />

      <TextInput
        label="Official VTU page"
        name="officialUrl"
        type="url"
        placeholder="https://vtu.ac.in/..."
        hint="Required. This is the portal's only claim about the syllabus — a student should be able to check it."
        error={errors.officialUrl}
      />

      <TextInput
        label="Notes"
        name="notes"
        maxLength={500}
        placeholder="Anything a student should know about this subject"
      />

      <div className="rounded-card border border-indigo-100 bg-parchment-sunk/40 p-4">
        <CheckboxGroup
          legend="Technical domains this subject feeds"
          name="domainIds"
          options={domains}
          columns={2}
          hint="Optional, but it is what lets a roadmap connect a subject to what the student said they want to do."
        />
      </div>

      <SubmitButton pendingLabel="Adding…">Add subject</SubmitButton>
    </form>
  );
}

export function RetireSubjectButton({
  subjectId,
  isActive,
}: {
  subjectId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useFormState(setVtuSubjectActive, idleState);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        className="rounded text-xs font-medium text-indigo-700 hover:underline"
      >
        {isActive ? "Retire" : "Restore"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
