/**
 * Spinner — loading indicator primitive.
 *
 * Animation respects prefers-reduced-motion (handled in primitives.css).
 * Always labelled for screen readers.
 */

import { spinnerClass, type SpinnerSize } from "./variants.js";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  label?: string;
}

export function Spinner({ size = "md", label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <span
      className={spinnerClass(size, className)}
      role="status"
      aria-label={label}
      {...props}
    />
  );
}
