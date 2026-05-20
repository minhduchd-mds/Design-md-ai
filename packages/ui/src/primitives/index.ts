/**
 * primitives — barrel export for @desygn/ui primitives.
 */

export { Button, type ButtonProps } from "./Button.js";
export { Input, type InputProps } from "./Input.js";
export { Card, type CardProps } from "./Card.js";
export { Badge, type BadgeProps } from "./Badge.js";
export { Spinner, type SpinnerProps } from "./Spinner.js";
export { Checkbox, type CheckboxProps } from "./Checkbox.js";
export { Switch, type SwitchProps } from "./Switch.js";
export { Avatar, type AvatarProps } from "./Avatar.js";
export { Select, type SelectProps, type SelectOption } from "./Select.js";
export { Dialog, type DialogProps } from "./Dialog.js";

export {
  buttonClass,
  inputClass,
  cardClass,
  badgeClass,
  spinnerClass,
  checkboxClass,
  switchClass,
  avatarClass,
  selectClass,
  dialogClass,
  initials,
  severityToTone,
  type ButtonVariant,
  type ButtonSize,
  type InputState,
  type CardVariant,
  type BadgeTone,
  type SpinnerSize,
  type AvatarSize,
  type SelectState,
  type DialogSize,
} from "./variants.js";

export { FOCUSABLE_SELECTOR, nextFocusIndex, isCloseKey } from "./focus-trap.js";
