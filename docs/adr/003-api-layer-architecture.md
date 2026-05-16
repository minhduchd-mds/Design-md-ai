# ADR-003: Centralized API Layer (apiClient + streamClient + queryStore)

**Status:** Accepted  
**Date:** 2026-05-14  
**Deciders:** Core team

## Context

Network calls were scattered across 12+ files with inconsistent error handling, no retry logic, and no caching. Each file independently called `fetch()` with different timeout/header patterns.

Key problems:
- No request deduplication (same endpoint called 3x in parallel)
- No retry on transient failures (503, network blips)
- No central place to add auth headers or rate-limit tokens
- SSE streaming had no backpressure handling

## Decision

Build a 3-layer API architecture:

### 1. `apiClient.ts` — HTTP foundation
- Single `fetch()` caller for the entire app
- Retry x3 with exponential backoff (respects `Retry-After` header)
- Request deduplication via in-flight Map (same key = share promise)
- Request/response interceptor chains
- AbortController + configurable timeout (default 30s)
- Typed `ApiError` with `{code, status, retryable}` for error routing

### 2. `streamClient.ts` — SSE/streaming
- POST-based ReadableStream with retry on 5xx
- Backpressure-aware reader (pauses if consumer is slow)
- `onToken` callback per chunk; returns full accumulated text
- Abort lifecycle integrated with apiClient's AbortController

### 3. `queryStore.ts` — SWR cache
- In-memory cache with stale-while-revalidate semantics
- `useQuery(key, fetcher)` hook with loading/error/data states
- `useMutation(mutator)` for write operations
- `invalidate()` / `invalidatePrefix()` for post-mutation cache busting
- Pure helpers (`getCacheEntry`, `setCacheEntry`) for non-React contexts

### 4. `rateLimit.ts` — Token bucket
- Client-side rate limiting before requests leave the browser
- Singletons: `chatRateLimit` (10 burst, 1/s), `apiRateLimit` (30 burst, 3/s)

### 5. `offlineQueue.ts` — IndexedDB queue
- Queues failed requests when offline; auto-flushes on `navigator.onLine`
- Dead-letter after 5 attempts
- Emits `offline:queued` / `offline:flushed` to EventBus

## Consequences

### Positive
- All network behavior defined in one place (retry, timeout, headers)
- Dedup prevents wasted bandwidth on concurrent renders
- SWR gives instant UI with background freshness
- Offline queue prevents data loss on flaky connections
- Rate limiter prevents API ban from rapid user actions

### Negative
- Learning curve: developers must use `apiClient.get/post` instead of raw `fetch`
- Cache invalidation complexity (stale data if forgotten)
- IndexedDB adds ~2KB to bundle and requires async init

### Alternatives Considered
- **TanStack Query**: Too heavy (40KB gzip) for a Figma plugin iframe with strict bundle budget
- **SWR library**: Similar concern; our queryStore is <3KB and covers our exact use cases
- **No client-side rate limit**: Rejected — Groq/Claude APIs have strict rate limits that cause poor UX when hit
