/**
 * Badge — small status label primitive.
 */

import { badgeClass, type BadgeTone } from "./variants.js";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span className={badgeClass(tone, className)} {...props}>
      {children}
    </span>
  );
}
