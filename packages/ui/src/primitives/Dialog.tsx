/**
 * Dialog — accessible modal primitive (dependency-free).
 *
 * Implements the WAI-ARIA dialog pattern:
 * - role="dialog" + aria-modal + aria-labelledby
 * - Focus moves into the dialog on open, returns to the trigger on close
 * - Tab / Shift+Tab are trapped within the dialog (wrap around)
 * - Escape closes; backdrop click closes
 *
 * Focus-index math lives in ./focus-trap (pure, unit-tested).
 */

import { useEffect, useId, useRef } from "react";
import { dialogClass, type DialogSize } from "./variants.js";
import { FOCUSABLE_SELECTOR, isCloseKey, nextFocusIndex } from "./focus-trap.js";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: DialogSize;
  children?: React.ReactNode;
  /** Optional footer (e.g. action buttons). */
  footer?: React.ReactNode;
}

export function Dialog({ open, onClose, title, size = "md", children, footer }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (first focusable, else the panel).
    const panel = panelRef.current;
    const focusables = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    (focusables[0] ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (isCloseKey(e.key)) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = nextFocusIndex(current, items.length, e.shiftKey);
        e.preventDefault();
        items[next]?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to whatever was focused before opening.
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="dsg-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={dialogClass(size)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="dsg-dialog__header">
          <h2 id={titleId} className="dsg-dialog__title">
            {title}
          </h2>
          <button
            type="button"
            className="dsg-dialog__close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="dsg-dialog__body">{children}</div>
        {footer && <footer className="dsg-dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
}
