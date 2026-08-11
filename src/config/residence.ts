/**
 * Residence type — where a student lives during term (migration 0007).
 *
 * Defined once and imported everywhere: the registration form, the faculty
 * filters, the student and faculty detail views, both CSV exports, and the
 * institution analytics all render these labels. Duplicating them per-file is
 * how a dropdown ends up saying "PG" in one place and "Paying guest" in
 * another for the same stored value.
 */

export const RESIDENCE_TYPES = [
  { value: "hostel", label: "College hostel" },
  { value: "pg", label: "PG / Paying guest" },
  { value: "flat", label: "Rented flat or apartment" },
  { value: "home", label: "Living at home" },
] as const;

export type ResidenceType = (typeof RESIDENCE_TYPES)[number]["value"];

export const RESIDENCE_VALUES = RESIDENCE_TYPES.map((r) => r.value) as [
  ResidenceType,
  ...ResidenceType[],
];

export const RESIDENCE_LABELS: Record<string, string> = Object.fromEntries(
  RESIDENCE_TYPES.map((r) => [r.value, r.label]),
);

/** The field's name in the interface. Change here, changes everywhere. */
export const RESIDENCE_FIELD_LABEL = "Residence type";

export function residenceLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return RESIDENCE_LABELS[value] ?? value;
}
