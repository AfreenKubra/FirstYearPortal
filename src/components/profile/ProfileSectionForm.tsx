"use client";

import { useFormState } from "react-dom";
import { Select, TextInput, CheckboxGroup } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "@/components/ui/FormStatus";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { idleState, type ActionState } from "@/lib/actions/form-state";
import type { LookupOption } from "@/lib/queries/student";

type ServerAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const QUOTA_OPTIONS = [
  { value: "cet", label: "KCET" },
  { value: "comedk", label: "COMEDK" },
  { value: "jee", label: "JEE / Central counselling" },
  { value: "management", label: "Management quota" },
  { value: "diploma_lateral", label: "Diploma lateral entry" },
  { value: "other", label: "Other" },
];

export type AcademicDefaults = {
  tenthPercentage: number | null;
  twelfthPercentage: number | null;
  quota: string | null;
  entranceRank: number | null;
  semester: number | null;
  section: string | null;
  admissionYear: number | null;
};

/**
 * Each section is an independent `<form action={serverAction}>`, so a student
 * can save one section and come back later (PRD 5.2) without the others
 * being validated or overwritten.
 */
export function AcademicSectionForm({
  action,
  defaults,
  complete,
}: {
  action: ServerAction;
  defaults: AcademicDefaults;
  complete: boolean;
}) {
  const [state, formAction] = useFormState(action, idleState);

  return (
    <Card as="section">
      <CardHeader
        title="Academic background"
        description="Your qualifying marks and current placement at the college."
        eyebrow={complete ? "Complete" : "Needs attention"}
      />
      <CardBody>
        <form action={formAction} noValidate className="space-y-4">
          <FormMessage state={state} />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="10th percentage"
              name="tenthPercentage"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={defaults.tenthPercentage ?? ""}
              error={state.fieldErrors?.tenthPercentage}
            />
            <TextInput
              label="12th / PUC percentage"
              name="twelfthPercentage"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={defaults.twelfthPercentage ?? ""}
              error={state.fieldErrors?.twelfthPercentage}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Admission quota"
              name="quota"
              placeholder="Select your quota"
              options={QUOTA_OPTIONS}
              defaultValue={defaults.quota ?? ""}
              error={state.fieldErrors?.quota}
            />
            <TextInput
              label="Entrance rank"
              name="entranceRank"
              type="number"
              min={0}
              defaultValue={defaults.entranceRank ?? ""}
              hint="Leave blank if you joined under management quota."
              error={state.fieldErrors?.entranceRank}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Semester"
              name="semester"
              placeholder="Select"
              options={[
                { value: 1, label: "Semester 1" },
                { value: 2, label: "Semester 2" },
              ]}
              defaultValue={defaults.semester ?? ""}
              error={state.fieldErrors?.semester}
            />
            <TextInput
              label="Section"
              name="section"
              placeholder="A"
              maxLength={4}
              className="uppercase"
              defaultValue={defaults.section ?? ""}
              error={state.fieldErrors?.section}
            />
            <TextInput
              label="Admission year"
              name="admissionYear"
              type="number"
              placeholder={String(new Date().getFullYear())}
              defaultValue={defaults.admissionYear ?? ""}
              error={state.fieldErrors?.admissionYear}
            />
          </div>

          <div className="flex justify-end border-t border-indigo-100 pt-4">
            <SubmitButton>Save section</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function SelectionSectionForm({
  action,
  title,
  description,
  legend,
  options,
  selected,
  complete,
  columns = 2,
}: {
  action: ServerAction;
  title: string;
  description: string;
  legend: string;
  options: LookupOption[];
  selected: number[];
  complete: boolean;
  columns?: 1 | 2 | 3;
}) {
  const [state, formAction] = useFormState(action, idleState);

  return (
    <Card as="section">
      <CardHeader
        title={title}
        description={description}
        eyebrow={complete ? "Complete" : "Needs attention"}
      />
      <CardBody>
        <form action={formAction} noValidate className="space-y-4">
          <FormMessage state={state} />

          <CheckboxGroup
            legend={legend}
            name="ids"
            options={options}
            defaultSelected={selected}
            error={state.fieldErrors?.ids}
            columns={columns}
          />

          <div className="flex justify-end border-t border-indigo-100 pt-4">
            <SubmitButton>Save section</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
