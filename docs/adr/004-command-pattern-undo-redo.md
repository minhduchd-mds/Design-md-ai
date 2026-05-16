# ADR-004: Command Pattern for Undo/Redo

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** Core team

## Context

Users editing Design.md content, rearranging screens in SplitView, or changing design parameters need the ability to undo mistakes. Without a structured approach, implementing undo requires per-feature snapshot logic scattered across components.

## Decision

Implement a **Command Bus** (`commandBus.ts`) with:

```typescript
interface Command {
  execute(): Promise<void> | void;
  undo(): Promise<void> | void;
  description: string;
}
```

### Core API
- `commandBus.execute(cmd)` — runs command, pushes to undo stack, clears redo stack
- `commandBus.undo()` — pops from undo, calls `cmd.undo()`, pushes to redo
- `commandBus.redo()` — pops from redo, calls `cmd.execute()`, pushes to undo
- `commandBus.peekUndo()` / `peekRedo()` — inspect next action description
- Max history: 50 commands (configurable)

### Helpers
- `makeSetCommand(desc, getter, setter, newVal)` — for simple state changes
- `makeBatchCommand(desc, commands[])` — atomic multi-step operations

### Keyboard Integration
- `useCommandShortcuts()` hook binds Ctrl+Z / Ctrl+Y (Cmd+Z / Cmd+Shift+Z on macOS)
- Skips when focus is inside `<input>`, `<textarea>`, or `contentEditable`
- Shows toast notification with action description on undo/redo

## Consequences

### Positive
- Uniform undo/redo across all features (design edits, screen reorder, setting changes)
- Commands are self-describing (toast shows what was undone)
- Batch commands enable atomic multi-step operations
- History is bounded — no memory leaks from unbounded stacks

### Negative
- Every undoable action must be wrapped in a Command object
- Async commands complicate error handling (what if undo fails?)
- Not suitable for real-time collaborative editing (no OT/CRDT)

### Future Extensions
- Persist command history to localStorage for cross-session undo
- Visual command history panel (like Photoshop History)
- Command replay for debugging/demo recording
