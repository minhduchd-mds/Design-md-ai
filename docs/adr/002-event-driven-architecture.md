# ADR-002: Event-Driven Architecture (EventBus + ErrorBus)

**Status:** Accepted  
**Date:** 2026-05-14  
**Deciders:** Core team

## Context

The main App component (3000+ lines) suffered from extreme prop-drilling: auth state changes, Figma connection events, toast notifications, and offline queue results all threaded through 5-10 levels of props.

This created:
- Tight coupling between unrelated modules
- Cascading re-renders on any state change
- Impossible to add cross-cutting concerns (logging, analytics) without editing every call site

## Decision

Introduce two typed pub/sub buses:

1. **`eventBus`** — domain events (15 typed channels):
   - `project:created/updated/deleted`
   - `design:generated`, `design:md:changed`
   - `figma:connected/disconnected/error`
   - `session:started/expired/plan:upgraded`
   - `toast:show`, `chat:cleared`, `tab:changed`
   - `offline:queued/flushed`, `online:restored`

2. **`errorBus`** — severity-tagged errors with isolated handlers:
   - Levels: `info`, `warning`, `error`, `fatal`
   - Convenience methods: `errorBus.network()`, `errorBus.auth()`, `errorBus.warn()`, `errorBus.fatal()`

Both use handler isolation (one handler throwing does not break others).

## Consequences

### Positive
- Any module can emit/subscribe without import chains
- Single subscription point in App for UI reactions (toasts, state resets)
- Easy to add analytics, logging, or Sentry without touching business logic
- Testable in isolation (emit event, verify handler called)

### Negative
- Implicit coupling — harder to trace "who emits X?" vs explicit props
- Event storms possible if emitters are not disciplined
- No guaranteed ordering across buses

### Mitigations
- TypeScript `EventMap` interface enforces payload shapes at compile time
- `listenerCount()` API helps detect leaks in tests
- `clear()` method for test cleanup
