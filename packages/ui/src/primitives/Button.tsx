/**
 * Button — accessible button primitive.
 *
 * - Native <button> for full keyboard + screen-reader support
 * - Focus-visible ring via primitives.css (WCAG 2.4.7)
 * - `loading` shows a spinner and sets aria-busy + disabled
 */

import { forwardRef } from "react";
import { buttonClass, type ButtonVariant, type ButtonSize } from "./variants.js";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="dsg-btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});
