/**
 * useCommandShortcuts — React hook that binds Ctrl+Z / Ctrl+Y to commandBus.
 *
 * Mount once at the App root. The hook handles:
 *  • Ctrl+Z  → commandBus.undo()
 *  • Ctrl+Y  → commandBus.redo()
 *  • Cmd+Z   → undo (macOS)
 *  • Cmd+Shift+Z → redo (macOS)
 *
 * Skips when focus is inside <input>, <textarea>, or contenteditable
 * so normal text editing is not disrupted.
 */
import { useEffect } from "react";
import { commandBus } from "./commandBus";
import { eventBus } from "./eventBus";

export function useCommandShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      if (isEditing) return;

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const isUndo = e.key === "z" && !e.shiftKey;
      const isRedo = e.key === "y" || (e.key === "z" && e.shiftKey);

      if (isUndo && commandBus.canUndo) {
        e.preventDefault();
        void commandBus.undo().then((desc) => {
          if (desc) eventBus.emit("toast:show", { message: `↩ Hoàn tác: ${desc}`, type: "info" });
        });
      } else if (isRedo && commandBus.canRedo) {
        e.preventDefault();
        void commandBus.redo().then((desc) => {
          if (desc) eventBus.emit("toast:show", { message: `↪ Làm lại: ${desc}`, type: "info" });
        });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
