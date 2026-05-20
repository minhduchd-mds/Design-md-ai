/**
 * Select — accessible dropdown built on a native <select>.
 *
 * A native <select> is fully accessible (keyboard, screen reader, mobile
 * pickers) for free — we only style it. Avoids the complexity of a custom
 * combobox while staying dependency-free.
 */

import { forwardRef, useId } from "react";
import { selectClass } from "./variants.js";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, error, placeholder, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <>
      <select
        ref={ref}
        id={selectId}
        className={selectClass(error ? "error" : "default", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} className="dsg-select__error" role="alert">
          {error}
        </span>
      )}
    </>
  );
});
