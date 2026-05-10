# DesignReady.ai — Dev Guide

## Commands
```
npm run dev       # Watch mode (UI + plugin)
npm run build     # Production → dist/
npm test          # Vitest (105 tests)
npm run lint      # ESLint 9
```

## Architecture
- **plugin/** → Figma sandbox (no DOM, no fetch). Only Figma API.
- **ui/** → React iframe (no figma.*). Only `parent.postMessage`.
- **shared/types.ts** → All message types + SerializedNode.
- **shared/viewport.ts** → Pure utilities usable from both sandboxes (e.g. viewport classification).
- Communication: typed `PluginMessage` via postMessage only.

## Hard Rules
- Never call Figma API in loops — batch everything.
- Never use `findAll()` — use `findAllWithCriteria()` on `currentPage` only.
- Serializer: `isMixed()` check before reading mixed properties. Max depth 15. Async calls (getMainComponentAsync) must be wrapped in try/catch — external library instances can fail.
- Scoring modules: pure functions, no side effects, no Figma API.
- Prompt text: always sanitize via `sanitize.ts` (injection risk).
- CSS Modules per component. Dark theme only. Gap-based layout.
- New serializer field: types.ts → serializer.ts → prompt-compact.ts.

## Repos
- **Official:** github.com/designready-ai/designready-ai (push here)
- **Dev:** github.com/Lapse18/designready-ai-plugin
- Remotes: `origin` = Lapse18, `official` = designready-ai
- Push workflow: work on `official-updates`, then `git push official official-updates:main`.
