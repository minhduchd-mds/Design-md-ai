/**
 * Input — accessible text input primitive.
 *
 * - Sets aria-invalid + aria-describedby when an error is present
 * - Error message rendered in a region linked to the input
 */

import { forwardRef, useId } from "react";
import { inputClass } from "./variants.js";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <>
      <input
        ref={ref}
        id={inputId}
        className={inputClass(error ? "error" : "default", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <span id={errorId} className="dsg-input__error" role="alert">
          {error}
        </span>
      )}
    </>
  );
});
