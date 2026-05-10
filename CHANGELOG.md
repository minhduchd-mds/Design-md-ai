# Changelog

All notable changes to DesignReady.ai are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.5] — 2026-04-28

Auto Layout Fix overhaul to comply with the user-stated spec: only the outermost user-selected frame keeps FIXED sizing, everything inside must be FILL or HUG. The previous implementation set every child to FIXED pixel widths, which broke responsive intent and produced brittle layouts.

### Fixed
- **Children of converted frames are no longer set to FIXED pixel sizes.** New `decideChildSizing` helper picks FILL on the cross-axis when a child matches its parent's inner cross size, otherwise HUG. FIXED is used only as a fallback for shapes that would collapse to 0×0 (RECTANGLE/ELLIPSE/VECTOR with no children).
- **Frame self-sizing now distinguishes outermost vs nested.** Only `selection[0]` (the user-selected outermost frame) keeps FIXED+original size. Non-outermost candidates either inherit from their parent's Auto Layout (via `decideChildSizing` relative to the parent) or default to HUG-HUG, which gets overridden when the parent's apply-step runs its own children loop. An `origSizes` map caches pre-conversion frame sizes so a parent's FILL detection uses each child's original dimensions, not its post-HUG shrunken size.
- **Counter-axis (cross-axis) alignment is now detected correctly.** The previous `detectAlignment` mixed primary and counter axes and had a documented "simplified" `containerCross` that was wrong for VERTICAL direction. Replaced with separated `detectPrimaryAlignment` and `detectCounterAlignment` helpers that compute per-axis math correctly.
- **"Value-pinned-right" patterns are now skipped instead of converted destructively.** When SPACE_BETWEEN is geometrically detected (first child at start, last at end) but gaps between adjacent children are very uneven (>8px spread), the conversion would reflow the children — for example, centering a label that was originally next to its icon. New `gapVariance` helper detects this; `analyzeFrame` now skips with the reason `Uneven gaps suggest a 'value-pinned-right' pattern — group related children manually first, then re-scan`.

### Changed
- Auto Layout Fix UI description and success message set realistic expectations: *"Best effort — Cmd+Z if a layout shifts unexpectedly."* README has a matching limitations note explaining that patterns like *icon + label tightly grouped + value pinned right* need a wrapper group that this tool intentionally does not create.

### Added
- 30 pure-function unit tests covering `canHugContent`, `decideChildSizing` (HORIZONTAL + VERTICAL), `detectPrimaryAlignment` (MIN / CENTER / MAX / SPACE_BETWEEN incl. n<3 ambiguity), `detectCounterAlignment` (MIN / CENTER / MAX with padding), and `gapVariance` (equal gaps, uneven value-pinned-right, vertical direction).

## [1.1.4] — 2026-04-28

Addresses the two specific issues raised in the v1.1.3 Figma Community re-review (request #1873667).

### Fixed
- **Rescan button did not actually rescan.** Clicking Rescan re-ran scoring on the cached `SerializedNode` instead of re-fetching the live selection from the plugin sandbox, so any Figma edits made between Scan and Rescan were invisible. Rescan now triggers `refreshSelection()` (mirroring the post-Quick-Fix flow) before re-running the scan; the initial-scan path is unchanged.
- **"Delete N empty layers" silently reported "0 nodes deleted".** Empty frames inside Component Instances were being flagged as deletable, but instance children are read-only in Figma, so `node.remove()` threw and was silently caught. The empty-frame walk in `scoring-meta.ts` now applies the same `isInInstance` guard that hidden-layer detection already used, so instance-internal empty frames are not flagged as actionable.

## [1.1.3] — 2026-04-28

Restores manifest fields required for the Figma Community publish to update the existing listing rather than create a new plugin entry.

### Fixed
- **`manifest.json` was missing the publish-side `id` and `networkAccess`.** The public repo's manifest historically used `"id": "designready-ai"` (a development identifier), but the version originally submitted to Figma Community used the numeric Community resource ID `"1619643293052051000"` plus `"networkAccess": { "allowedDomains": ["none"] }`. v1.1.2 added `documentAccess: "dynamic-page"` but did not restore the other two fields. Re-publishing without them would cause Figma to treat the upload as a new plugin instead of an update to the existing review submission. Both fields are now restored.

## [1.1.2] — 2026-04-28

Compatibility fix surfaced by Figma Community review: the plugin used synchronous node lookups that throw in dynamic-page documentAccess mode.

### Fixed
- **Synchronous `figma.getNodeById()` calls broke under `documentAccess: "dynamic-page"`.** Four call sites (rename apply, divider convert, delete-nodes, jump-to-node) threw `Cannot call with documentAccess: dynamic-page. Use figma.getNodeByIdAsync instead.` when the reviewer tested the plugin in dynamic-page mode. All four migrated to `figma.getNodeByIdAsync`; `convertDividers` is now async and awaited from the message handler.

### Changed
- `manifest.json` opts in to `"documentAccess": "dynamic-page"` so the plugin explicitly declares dynamic-page compatibility and any future regression is caught immediately.

## [1.1.1] — 2026-04-22

Completion patch for v1.1.0 — a post-release audit caught that the viewport gap fix was partial.

### Fixed
- **Viewport gap fix was incomplete in v1.1.0.** The scoring-meta module (`ui/lib/scoring-meta.ts`) carried a third hand-duplicated copy of the viewport cascade that the P3.3 deduplication did not catch. Consequence: frames between 1025 and 1199px (iPad Pro landscape at 1180/1194, Bootstrap containers at 1128, mid-desktops at 1100) were still classified as `"unknown"` in Meta scoring and received a score penalty. Fixed by importing `detectViewport` from `shared/viewport.ts` — the shared module is now truly the single source of truth.
- **README responsive-detection list** was missing `-phone` and `-laptop` suffixes. The code always recognised them; the list now matches.

### Changed
- Test `scoring-meta.test.ts > "detects unknown viewport"` rewritten as `"classifies mid-desktop widths (1025-1199px) as desktop, no penalty"`. Previous test asserted the buggy behaviour as correct, which is why the bug survived v1.1.0 despite the test suite being green.

## [1.1.0] — 2026-04-22

Maintenance and quality release based on a full README-vs-code audit. One real bug fix in batch prompts, several documentation corrections, and an expanded responsive detection.

### Added
- Responsive-suffix detection now recognises Tailwind-style breakpoints (`xs`, `2xl`, `3xl`) plus `phone` and `laptop` long forms, and an allowlist of common Figma frame widths (`320`, `375`, `428`, `768`, `1024`, `1194`, `1280`, `1440`, `1920`, …). Previously only `desktop|mobile|tablet|sm|md|lg|xl|xxl` were recognised. Single-letter tokens (`s`, `m`, `l`) are deliberately excluded to avoid false positives.
- `ComponentSet Variants` section in the README documenting the current behaviour (only the Default variant is serialised as a full layout tree) and the Batch Scan workaround for structurally different variants.
- Mention of the 60% confidence threshold for Auto Layout Fix in the README features list, plus the three possible skip reasons.
- Dedicated tests for `extractBaseName` (plugin side) and `detectViewport` (shared), covering boundary cases and false-positive safeguards.
- Vitest config now includes `plugin/**/__tests__/**/*.test.ts` so pure helpers on the plugin side can be covered.

### Fixed
- **Skill-sync block was duplicated N+1 times in batch prompts.** The block was renamed from `## skill-sync` to `# TASK 2 — Skill Sync` but the regex in `batch-scanner.ts` that stripped per-component blocks still matched the old marker. Result: the Skill Sync block appeared once per component plus once at the end. Now passed through `skipSkillSync` to `scan()` so the block is emitted exactly once, at the end of the batch prompt.
- **Viewport detection gap for 1025–1199px frames.** Frames in this range (iPad Pro landscape at 1180/1194, Bootstrap containers at 1128, generic mid-desktops at 1100) were classified as `"unknown"` because the logic required `>= 1200` for desktop. Claude received no semantic viewport signal for these. Fixed by treating anything above 1024 as `desktop`; `"unknown"` is now reserved for zero/negative widths.

### Changed
- Viewport classification deduplicated into `shared/viewport.ts`. `detectViewport(width): ViewportType` is now the single source of truth for both plugin and UI sandboxes. Previous hand-duplicated copies (`detectViewportType` in the plugin, `viewportTag` in the UI) have been removed.
- `README.md` and `CLAUDE.md` corrected for several stale references:
  - Skill-sync block name (`## skill-sync` → `# TASK 2 — Skill Sync`)
  - Batch prompt threshold (60+ average, separate from the 75+ standalone gate) is now documented
  - Test count updated (84 → 105)
  - Stale claim that `CLAUDE.md` is gitignored replaced with the actual push workflow (`official-updates` → `official/main`)
- CLAUDE.md compact rewrite. Architecture note extended to document `shared/viewport.ts` as the pattern for pure cross-sandbox utilities.

## [1.0.0] — 2026-03-26

Initial public release.

- 6-Dimension Scoring (Naming, Structure, Tokens, Meta, Completeness, Variants)
- Compact prompt generation with self-check and state hints
- Skill Sync block for Claude-side design system maintenance
- Design System Profiles with import from Figma Variables, Paint Styles, and local components
- Batch Mode with atomic build order (atoms → molecules → organisms)
- Auto Layout Fix with confidence-based analysis
- Quick Fixes (rename generic layers, convert dividers, delete hidden/empty nodes)
- Atomic Detection (atom/molecule/organism classification)
- Responsive viewport detection from sibling frames
- Prompt injection protection via sanitisation of layer names and text content

[Unreleased]: https://github.com/designready-ai/designready-ai/compare/v1.1.5...HEAD
[1.1.5]: https://github.com/designready-ai/designready-ai/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/designready-ai/designready-ai/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/designready-ai/designready-ai/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/designready-ai/designready-ai/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/designready-ai/designready-ai/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/designready-ai/designready-ai/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/designready-ai/designready-ai/releases/tag/v1.0.0
