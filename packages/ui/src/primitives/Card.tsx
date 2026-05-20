/**
 * Card — surface container primitive.
 */

import { forwardRef } from "react";
import { cardClass, type CardVariant } from "./variants.js";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cardClass(variant, className)} {...props}>
      {children}
    </div>
  );
});
