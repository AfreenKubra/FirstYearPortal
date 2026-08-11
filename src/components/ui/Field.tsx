"use client";

import { useId } from "react";
import type {
  ComponentPropsWithoutRef,
  ForwardedRef,
  ReactNode,
} from "react";
import { forwardRef } from "react";

/**
 * Form primitives.
 *
 * Every control here is label-bound by a generated id and wires
 * `aria-describedby` / `aria-invalid` from the error state, so an error is
 * announced to a screen reader rather than only being visible (PRD section 6,
 * accessibility). Components that need this cannot opt out — which is the
 * point of centralising it.
 */

type FieldShellProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  describedBy: string;
};

function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  describedBy,
}: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink-muted"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${describedBy}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${describedBy}-error`}
          role="alert"
          className="text-xs font-medium text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-lg border bg-white px-3.5 text-sm text-ink shadow-sm " +
  "placeholder:text-ink-faint transition-colors " +
  "disabled:cursor-not-allowed disabled:bg-parchment-sunk";

function controlClasses(hasError: boolean, extra?: string) {
  return [
    CONTROL,
    hasError
      ? "border-danger focus:border-danger"
      : "border-indigo-200 hover:border-indigo-300 focus:border-indigo-500",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

type TextInputProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

export const TextInput = forwardRef(function TextInput(
  { label, error, hint, id, className, required, ...props }: TextInputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const described = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      describedBy={fieldId}
    >
      <input
        {...props}
        id={fieldId}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={controlClasses(Boolean(error), `h-11 ${className ?? ""}`)}
      />
    </FieldShell>
  );
});

type SelectProps = ComponentPropsWithoutRef<"select"> & {
  label: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
};

export const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    options,
    placeholder,
    id,
    className,
    required,
    ...props
  }: SelectProps,
  ref: ForwardedRef<HTMLSelectElement>,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const described = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      describedBy={fieldId}
    >
      <select
        {...props}
        id={fieldId}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={controlClasses(Boolean(error), `h-11 ${className ?? ""}`)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

type CheckboxGroupProps = {
  legend: string;
  name: string;
  options: Array<{ id: number; name: string }>;
  defaultSelected?: number[];
  error?: string;
  hint?: string;
  columns?: 1 | 2 | 3;
};

/**
 * Multi-select rendered as real checkboxes in a fieldset rather than a
 * custom widget — a native fieldset/legend already gives the group an
 * accessible name and keyboard behaviour that a div-based chip picker would
 * have to reimplement (and usually gets wrong).
 */
export function CheckboxGroup({
  legend,
  name,
  options,
  defaultSelected = [],
  error,
  hint,
  columns = 2,
}: CheckboxGroupProps) {
  const selected = new Set(defaultSelected);
  const gridCols =
    columns === 3
      ? "sm:grid-cols-3"
      : columns === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-1";

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink-muted">{legend}</legend>
      {hint && !error && <p className="text-xs text-ink-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <div className={`grid grid-cols-1 gap-2 ${gridCols}`}>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-indigo-100 bg-white px-3 py-2.5 text-sm text-ink transition-colors hover:border-indigo-300 hover:bg-indigo-50/60 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
          >
            <input
              type="checkbox"
              name={name}
              value={option.id}
              defaultChecked={selected.has(option.id)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-indigo-300 text-indigo-700 accent-indigo-700"
            />
            <span>{option.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
