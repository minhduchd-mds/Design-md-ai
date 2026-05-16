# ADR-001: Dual-Mode Authentication (Supabase + localStorage)

**Status:** Accepted  
**Date:** 2026-05-14  
**Deciders:** Core team

## Context

The app needs authentication that works in:
- **Production** — cloud-hosted with persistent accounts, OAuth flows, token refresh
- **Offline/Dev** — local development without network, Figma plugin sandbox, demos

A single auth implementation cannot serve both. The prior localStorage-only approach used AES-GCM encryption but offered no real account persistence.

## Decision

Implement a **repository pattern** (`authRepo.ts`) that selects strategy at startup:

```
const USE_SUPABASE = supabase !== null;
```

- If `VITE_SUPABASE_URL` is configured, `authRepo` delegates to Supabase Auth (signUp, signInWithPassword, getSession, signOut).
- Otherwise, it falls back to the existing localStorage + AES-GCM encryption flow.

The UI layer imports only `authRepo` — never `auth.ts` or `supabase.ts` directly.

## Consequences

### Positive
- Zero UI changes when switching backends
- Offline development works without any Supabase project
- Clear seam for future providers (Auth0, Clerk, etc.)
- EventBus integration (`session:started`, `session:expired`) decouples auth state from component tree

### Negative
- Two code paths to maintain and test
- localStorage mode has no real password hashing (AES-GCM is encryption, not bcrypt)
- Session TTL semantics differ (Supabase uses refresh tokens; local uses fixed 12h expiry)

### Risks
- Must ensure Supabase client is tree-shaken when unused (currently null-guarded)
- Plan upgrades in Supabase mode require a server-side admin API call (not implemented client-side)
