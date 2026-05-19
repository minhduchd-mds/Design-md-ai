# Desygn AI — API Documentation

> For the developer setup guide see [DEV_GUIDE.md](./DEV_GUIDE.md).
> For self-hosting instructions see [SELF_HOSTING.md](./SELF_HOSTING.md).

---

## Table of Contents

1. [Plugin Message Protocol](#1-plugin-message-protocol)
   - [Message Types](#message-types)
   - [SerializedNode Schema](#serializednode-schema)
   - [Communication Flow](#communication-flow)
2. [Zod Schemas](#2-zod-schemas)
   - [DesignContext Schema](#designcontext-schema)
   - [Checklist Schema](#checklist-schema)
   - [Audit Schema](#audit-schema)
   - [GitHub Schema](#github-schema)
3. [REST API Endpoints](#3-rest-api-endpoints)
   - [POST /api/checklist/audit-web](#post-apichecklistaudit-web)
   - [POST /api/github/create-checklist-issues](#post-apigithubcreate-checklist-issues)
   - [POST /api/github/sync-webhook](#post-apigithubsync-webhook)
   - [POST /api/chat-stream](#post-apichat-stream)
   - [POST /api/analyze-image](#post-apianalyze-image)
4. [Agent System](#4-agent-system)
   - [Agent Interface](#agent-interface)
   - [Built-in Agents](#built-in-agents)
   - [Creating Custom Agents](#creating-custom-agents)
5. [UX Checklist Orchestrator](#5-ux-checklist-orchestrator)
   - [CriteriaRegistry](#criteriaregistry)
   - [LearningLoop](#learningloop)
   - [Running an Audit](#running-an-audit)
6. [Evidence Memory](#6-evidence-memory)
   - [Storing Evidence](#storing-evidence)
   - [Querying (HNSW search)](#querying-hnsw-search)
   - [Snapshot Import/Export](#snapshot-importexport)
7. [Permissions (RBAC)](#7-permissions-rbac)
   - [Roles and Scopes](#roles-and-scopes)
   - [Usage Examples](#usage-examples)
8. [JSON Schema to Zod](#8-json-schema-to-zod)
   - [Runtime Schema Conversion](#runtime-schema-conversion)
   - [Supported Types](#supported-types)

---

## 1. Plugin Message Protocol

The Figma plugin and the web UI communicate exclusively via the `postMessage` API. The plugin runs in a sandboxed iframe; all data crosses the boundary as plain JSON objects conforming to the `PluginMessage` discriminated union.

### Message Types

All messages share a required `type` discriminant. Defined in `shared/types.ts`.

#### Selection messages

| `type` | Direction | Payload |
|---|---|---|
| `selection-change` | Plugin → UI | `{ node: SerializedNode \| null; name: string; selectionCount?: number; resolvedFromComponentSet?: boolean; componentSetName?: string }` |
| `no-selection` | Plugin → UI | _(empty)_ |
| `request-selection` | UI → Plugin | _(empty)_ |

#### Rename fix messages

| `type` | Direction | Payload |
|---|---|---|
| `request-renames` | UI → Plugin | _(empty)_ |
| `renames-result` | Plugin → UI | `{ entries: RenameEntry[] }` |
| `apply-renames` | UI → Plugin | `{ entries: RenameEntry[] }` |
| `renames-applied` | Plugin → UI | `{ count: number }` |

#### Auto Layout messages

| `type` | Direction | Payload |
|---|---|---|
| `request-autolayout-analysis` | UI → Plugin | _(empty)_ |
| `autolayout-analysis-result` | Plugin → UI | `{ candidates: AutoLayoutCandidate[]; skipped: AutoLayoutSkipped[] }` |
| `apply-autolayout` | UI → Plugin | `{ nodeIds: string[] }` |
| `autolayout-applied` | Plugin → UI | `{ count: number }` |

#### Accessibility Audit messages

| `type` | Direction | Payload |
|---|---|---|
| `request-a11y-audit` | UI → Plugin | _(empty)_ |
| `a11y-audit-result` | Plugin → UI | `{ audit: AccessibilityAudit }` |

#### Batch Mode messages

| `type` | Direction | Payload |
|---|---|---|
| `request-batch-selection` | UI → Plugin | _(empty)_ |
| `batch-selection-result` | Plugin → UI | `{ nodes: SerializedNode[] }` |

#### Design System messages

| `type` | Direction | Payload |
|---|---|---|
| `get-design-system-snapshot` | UI → Plugin | _(empty)_ |
| `design-system-snapshot-result` | Plugin → UI | `{ snapshot: DesignSystemSnapshot }` |
| `get-figma-color-variables` | UI → Plugin | _(empty)_ |
| `figma-color-variables-result` | Plugin → UI | `{ tokens: Record<string, string>; fileName: string; count: number }` |

#### Profile management messages (v1)

| `type` | Direction | Payload |
|---|---|---|
| `load-profiles` | UI → Plugin | _(empty)_ |
| `profiles-loaded` | Plugin → UI | `{ profiles: PluginProfile[]; activeId: string \| null }` |
| `save-profile` | UI → Plugin | `{ profile: PluginProfile }` |
| `profile-saved` | Plugin → UI | `{ profiles: PluginProfile[] }` |
| `set-active-profile` | UI → Plugin | `{ profileId: string \| null }` |
| `delete-profile` | UI → Plugin | `{ profileId: string }` |

#### Evidence Memory Sync (v3)

| `type` | Direction | Payload |
|---|---|---|
| `request-evidence-sync` | UI → Plugin | `{ content: string; source: string }` |
| `evidence-sync-result` | Plugin → UI | `{ evidenceId: string; stored: boolean }` |

#### Utility messages

| `type` | Direction | Payload |
|---|---|---|
| `resize` | UI → Plugin | `{ width: number; height: number }` |
| `select-node` | UI → Plugin | `{ nodeId: string; notify?: string }` |
| `delete-nodes` | UI → Plugin | `{ nodeIds: string[] }` |
| `nodes-deleted` | Plugin → UI | `{ count: number }` |
| `convert-dividers` | UI → Plugin | `{ nodeIds: string[] }` |
| `dividers-converted` | Plugin → UI | `{ count: number }` |

**Sending a message from the plugin:**

```ts
figma.ui.postMessage({ type: "selection-change", node: serializedNode, name: "Button" });
```

**Receiving in the UI iframe:**

```ts
window.addEventListener("message", (event) => {
  const msg = event.data.pluginMessage as PluginMessage;
  if (msg.type === "selection-change") {
    console.log(msg.node); // SerializedNode | null
  }
});
```

**Sending from the UI to the plugin:**

```ts
parent.postMessage({ pluginMessage: { type: "request-renames" } }, "*");
```

---

### SerializedNode Schema

`SerializedNode` is the canonical representation of a Figma node transmitted across the message boundary. It is defined in `shared/types.ts`.

```ts
interface SerializedNode {
  // Identity
  id: string;
  name: string;
  type: string;            // Figma node type, e.g. "FRAME", "TEXT", "COMPONENT"

  // Visibility & positioning
  visible?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;

  // Auto Layout
  layoutMode?: "HORIZONTAL" | "VERTICAL";
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;

  // Appearance
  fills?: SerializedPaint[];
  strokes?: SerializedPaint[];
  strokeWeight?: number;
  strokeAlign?: "CENTER" | "INSIDE" | "OUTSIDE";
  cornerRadius?: number | number[];
  opacity?: number;
  effects?: SerializedEffect[];
  layoutGrids?: SerializedLayoutGrid[];

  // Constraints
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  clipsContent?: boolean;
  constraints?: { horizontal: string; vertical: string };

  // Typography (TEXT nodes)
  characters?: string;
  fontSize?: number;
  fontName?: { family: string; style: string };
  fontWeight?: number;
  lineHeight?: number | string;
  letterSpacing?: number;
  textAlignHorizontal?: string;
  textDecoration?: string;
  textCase?: string;
  textAutoResize?: string;
  textTruncation?: string;
  maxLines?: number;

  // Component / instance
  isComponent?: boolean;
  isInstance?: boolean;
  componentName?: string;
  variantProperties?: Record<string, string>;
  componentPropertyDefinitions?: SerializedPropertyDef[];
  availableVariants?: Record<string, string[]>;
  componentDescription?: string;
  componentProperties?: Record<string, { type: string; value: string | boolean }>;

  // v3: Accessibility & Interaction Metadata
  inferredRole?: string;           // ARIA role inferred from name/type
  touchTargetCompliant?: boolean;  // WCAG 2.2 — 24×24 px minimum
  contrastRatio?: number;          // contrast ratio vs parent background
  hasInteractions?: boolean;       // has hover/interaction states defined
  responsiveBehavior?: "fixed" | "fluid" | "adaptive";

  children?: SerializedNode[];
}
```

**Sub-types:**

```ts
interface SerializedPaint {
  type: string;                     // "SOLID", "LINEAR_GRADIENT", etc.
  color?: { r: number; g: number; b: number };
  opacity?: number;
  boundToVariable?: boolean;
  variableName?: string;
  gradientStops?: { color: { r: number; g: number; b: number; a: number }; position: number }[];
  gradientAngle?: number;
}

interface SerializedEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

interface SerializedLayoutGrid {
  pattern: "COLUMNS" | "ROWS" | "GRID";
  count?: number;
  gutterSize?: number;
  alignment?: string;
  offset?: number;
  sectionSize?: number;
}

interface SerializedPropertyDef {
  name: string;
  type: "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP";
  values?: string[];
  defaultValue?: string | boolean;
}
```

**Important constraints:**

- Maximum serialization depth is 15 (controlled by `PROMPT_COMPACT_MAX_DEPTH = 12` for prompt output).
- Always call `isMixed()` before reading any potentially mixed Figma property. The serializer in `ui/src/scanner/serializer.ts` handles this.
- Avoid `findAll()` — use `findAllWithCriteria()` scoped to `currentPage`.

---

### Communication Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Figma Plugin (plugin/code.ts)                               │
│  - Runs in Figma sandbox (access to figma.* APIs)           │
│  - Serializes Figma nodes → SerializedNode                  │
│  - Sends via figma.ui.postMessage(msg)                      │
└──────────────────────────┬───────────────────────────────────┘
                           │  postMessage (JSON)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  UI iframe (web/src/)                                        │
│  - Receives via window.addEventListener("message", ...)      │
│  - Renders React components                                  │
│  - Calls REST API endpoints (/api/*) for AI features        │
└──────────────────────────────────────────────────────────────┘
                           │  HTTP
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Vercel Serverless / Edge Functions (api/)                   │
│  - Rate-limited via Upstash Redis sliding window            │
│  - AI via Groq LLM (llama-3.3-70b-versatile)               │
│  - GitHub integration via REST API                          │
└──────────────────────────────────────────────────────────────┘
```

Scan timeout is `SCAN_TIMEOUT_MS = 10_000` ms (10 seconds). The UI side enforces this when waiting for plugin responses.

---

## 2. Zod Schemas

All schemas are exported from `shared/schemas/index.ts` and can be imported directly:

```ts
import { DesignContextSchema, ChecklistCriterionSchema, AuditRunSchema } from "@shared/schemas";
```

---

### DesignContext Schema

**Purpose:** Describes the full design input passed from any source (Figma plugin, screenshot, URL, etc.) into the audit pipeline.

**Source:** `shared/schemas/designContext.schema.ts`

```ts
const DesignSourceSchema = z.enum([
  "figma-plugin",
  "figma-link",
  "screenshot",
  "web-url",
  "manual-spec",
]);

const DesignNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  inferredRole: z.string().optional(),
  contrastRatio: z.number().optional(),
  touchTargetCompliant: z.boolean().optional(),
  children: z.lazy(() => DesignNodeSchema.array()).optional(),
});

const DesignContextSchema = z.object({
  source: DesignSourceSchema,
  sourceRef: z.string().optional(),       // Figma URL, screenshot path, etc.
  projectId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  nodes: DesignNodeSchema.array(),
  metadata: z.object({
    fileName: z.string().optional(),
    pageName: z.string().optional(),
    viewportType: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
    componentCount: z.number().int().nonnegative(),
    totalNodes: z.number().int().nonnegative(),
  }),
});
```

**Example JSON:**

```json
{
  "source": "figma-plugin",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-05-19T08:00:00.000Z",
  "nodes": [
    {
      "id": "1:2",
      "name": "Button/Primary",
      "type": "COMPONENT",
      "width": 120,
      "height": 40,
      "inferredRole": "button",
      "touchTargetCompliant": true,
      "contrastRatio": 6.2
    }
  ],
  "metadata": {
    "fileName": "Design System v3",
    "pageName": "Components",
    "viewportType": "desktop",
    "componentCount": 1,
    "totalNodes": 1
  }
}
```

---

### Checklist Schema

**Purpose:** Defines individual checklist criteria and their evaluation results.

**Source:** `shared/schemas/checklist.schema.ts`

```ts
const CheckSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
const CheckStatusSchema   = z.enum(["pass", "fail", "warn", "skip", "error"]);

const ChecklistCriterionSchema = z.object({
  id:          z.string(),
  category:    z.string(),
  name:        z.string(),
  description: z.string(),
  severity:    CheckSeveritySchema,
  source:      z.enum(["wcag", "material3", "ant-design", "vts", "custom"]),
  tags:        z.string().array().default([]),
});

const CheckResultSchema = z.object({
  checkId:    z.string(),
  status:     CheckStatusSchema,
  score:      z.number().min(0).max(1),
  severity:   CheckSeveritySchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason:     z.string().optional(),
  fixSuggestion: z.object({
    description: z.string(),
    effort: z.enum(["trivial", "small", "medium", "large"]).optional(),
    impact: z.enum(["low", "medium", "high", "critical"]).optional(),
  }).optional(),
});
```

**Example JSON (criterion):**

```json
{
  "id": "a11y-contrast-4.5",
  "category": "accessibility",
  "name": "Color contrast ratio",
  "description": "Text must have a contrast ratio of at least 4.5:1 against its background (WCAG 1.4.3 AA).",
  "severity": "critical",
  "source": "wcag",
  "tags": ["contrast", "color", "text", "wcag-aa"]
}
```

**Example JSON (result):**

```json
{
  "checkId": "a11y-contrast-4.5",
  "status": "fail",
  "score": 0.2,
  "severity": "critical",
  "confidence": 0.95,
  "reason": "Contrast ratio is 2.1:1, below the 4.5:1 minimum.",
  "fixSuggestion": {
    "description": "Darken the text color from #999 to #595959 for AA compliance.",
    "effort": "trivial",
    "impact": "critical"
  }
}
```

---

### Audit Schema

**Purpose:** Represents a full audit run with all check results and evidence artifacts.

**Source:** `shared/schemas/audit.schema.ts`

```ts
const EvidenceArtifactSchema = z.object({
  source: z.enum(["figma-node", "playwright-screenshot", "manual", "ai-vision"]),
  nodeId:        z.string().optional(),
  selector:      z.string().optional(),
  screenshotUrl: z.string().url().optional(),
  boundingBox: z.object({
    x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  }).optional(),
  observed: z.string(),
  expected: z.string(),
});

const AuditRunSchema = z.object({
  id:                      z.string().uuid(),
  projectId:               z.string().uuid(),
  designContextVersionId:  z.string().uuid().optional(),
  source:                  DesignSourceSchema,
  overallScore:            z.number().int().min(0).max(100),
  status:                  z.enum(["running", "completed", "failed", "cancelled"]),
  results:                 CheckResultSchema.array(),
  evidence:                z.record(z.string(), EvidenceArtifactSchema.array()),
  createdAt:               z.string().datetime(),
});
```

**Notes:**
- `evidence` is keyed by `checkId`. Each check can have multiple evidence artifacts.
- `overallScore` is 0–100 (integer). Individual `CheckResult.score` is 0–1 (float).

---

### GitHub Schema

**Purpose:** Validates input for creating GitHub issues and PRs from audit results.

**Source:** `shared/schemas/github.schema.ts`

```ts
const GitHubLabelSchema = z.enum([
  "bug", "accessibility", "design-system", "ui-ux",
  "auto-generated", "checklist-failure", "high-priority", "low-priority",
]);

const GitHubIssueInputSchema = z.object({
  repo:      z.string().regex(/^[^/]+\/[^/]+$/), // "owner/repo" format
  title:     z.string().min(1).max(256),
  body:      z.string().min(1),
  labels:    GitHubLabelSchema.array().default(["auto-generated"]),
  assignees: z.string().array().optional(),
});

const GitHubIssueResponseSchema = z.object({
  id:        z.number(),
  number:    z.number(),
  url:       z.string().url(),
  htmlUrl:   z.string().url(),
  state:     z.enum(["open", "closed"]),
  title:     z.string(),
  createdAt: z.string().datetime(),
});

const GitHubPRInputSchema = z.object({
  repo:   z.string().regex(/^[^/]+\/[^/]+$/),
  title:  z.string().min(1).max(256),
  body:   z.string(),
  head:   z.string(),
  base:   z.string().default("main"),
  draft:  z.boolean().default(true),
  labels: z.string().array().optional(),
});
```

---

## 3. REST API Endpoints

All endpoints:
- Use CORS headers (allowed origins configured via environment).
- Enforce rate limits via Upstash Redis sliding-window (gracefully degrade to allow-all when Redis is unconfigured).
- Return JSON bodies on errors.
- Set `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` response headers.

**Common error response shape:**

```json
{
  "error": "Human-readable error message",
  "details": [ { "path": "field.name", "message": "validation error" } ]
}
```

---

### POST /api/checklist/audit-web

**Runtime:** Vercel Node.js serverless  
**Rate limit:** 10 requests / 60 s per IP

Fetches a target URL (no browser/Playwright required), parses the HTML with Node.js built-ins, and returns structured accessibility and structural data that the AI auditor can consume.

**Request body:**

```ts
{
  url: string;             // Required. Absolute http:// or https:// URL.
  viewport?: {
    width: number;         // 320–3840
    height: number;        // 240–2160
  };
  waitForSelector?: string; // Informational only — no browser is used.
}
```

**Success response (200):**

```json
{
  "url": "https://example.com",
  "fetchedAt": "2025-05-19T08:00:00.000Z",
  "title": "Example Domain",
  "headings": [
    { "level": 1, "text": "Welcome" },
    { "level": 2, "text": "About" }
  ],
  "images": [
    { "src": "/logo.png", "alt": "Company logo", "width": 200, "height": 80 }
  ],
  "links": [
    { "href": "https://other.com/page", "text": "Visit page", "isExternal": true }
  ],
  "meta": {
    "viewport": "width=device-width, initial-scale=1",
    "description": "Page description",
    "ogImage": "https://example.com/og.png",
    "ogTitle": "Example",
    "colorScheme": "light dark"
  },
  "accessibility": {
    "lang": "en",
    "landmarkCount": 4,
    "ariaLabelCount": 12,
    "formLabelCount": 6,
    "headingHierarchyValid": true,
    "imagesWithoutAlt": 0
  },
  "performance": {
    "htmlBytes": 24576,
    "resourceEstimate": 42
  }
}
```

**Error codes:**

| Status | Cause |
|---|---|
| 400 | Invalid request body (Zod validation failure) |
| 405 | Non-POST request |
| 429 | Rate limit exceeded — check `Retry-After` header |
| 500 | Fetch failed, non-HTML response, or server misconfiguration |

---

### POST /api/github/create-checklist-issues

**Runtime:** Vercel Node.js serverless  
**Rate limit:** 20 requests / 60 s per IP  
**Auth:** `Authorization: Bearer <token>` or `X-API-Key: <key>` header required  
**Requires env:** `GITHUB_TOKEN`

Creates one or more GitHub issues from UI/UX checklist audit failures. Each issue is rendered as a structured Markdown template with evidence and acceptance criteria.

**Request body** (single issue or array):

```ts
// Single issue
{
  repo:               string;  // "owner/repo" format
  checkId:            string;
  category:           string;
  criterion:          string;
  severity:           "critical" | "high" | "medium" | "low";
  confidence:         number;  // 0.0–1.0
  expected:           string;
  observed:           string;
  evidence: {
    source:          string;
    page?:           string;
    selector?:       string;
    screenshotUrl?:  string;   // Must be a valid URL if provided
  };
  fixSuggestion:      string;
  acceptanceCriteria: string[]; // At least one entry required
}

// Batch: wrap in an array
[ { ...issue1 }, { ...issue2 } ]
```

**Success response (201):**

```json
{
  "created": [
    {
      "checkId": "a11y-contrast-4.5",
      "issueNumber": 42,
      "url": "https://github.com/owner/repo/issues/42",
      "title": "[Accessibility] Color contrast ratio — contrast"
    }
  ],
  "failed": [],
  "total": 1
}
```

**Error codes:**

| Status | Cause |
|---|---|
| 400 | Invalid request body |
| 401 | Missing or invalid auth header |
| 405 | Non-POST request |
| 429 | Rate limit exceeded |
| 500 | `GITHUB_TOKEN` not configured, or GitHub API error |

**Notes:**
- Issues are created with labels `["auto-generated", "checklist-failure"]` plus `"high-priority"` for critical/high severity.
- GitHub 5xx errors are retried up to 2 times with exponential backoff (base 1 s).
- Issue body includes verification commands (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`).

---

### POST /api/github/sync-webhook

**Runtime:** Vercel Node.js serverless  
**Rate limit:** 50 requests / 60 s per IP  
**Signature verification:** HMAC SHA-256 via `GITHUB_WEBHOOK_SECRET` env var

Receives and verifies GitHub webhook events. Handles `issues`, `pull_request`, `check_suite`, and `ping` events.

**Required headers from GitHub:**

```
X-GitHub-Event: issues | pull_request | check_suite | ping
X-Hub-Signature-256: sha256=<hmac-hex>
Content-Type: application/json
```

**Request body:** GitHub webhook payload (passed through as-is).

**Success response (200):**

```json
{ "received": true }
```

**Error codes:**

| Status | Cause |
|---|---|
| 401 | Signature verification failed |
| 405 | Non-POST request |
| 429 | Rate limit exceeded |

**Notes:**
- If `GITHUB_WEBHOOK_SECRET` is not set, signature verification is skipped with a console warning. Set this env var to secure the endpoint.
- Timing-safe comparison (`crypto.timingSafeEqual`) prevents timing-attack signature bypass.
- Handled events are currently logged; add custom logic inside the handler functions to integrate with your data layer.
- `ping` events (sent on webhook creation) are accepted and logged.

---

### POST /api/chat-stream

**Runtime:** Vercel Edge (30 s max duration)  
**Rate limit:** 20 requests / 60 s per IP  
**Requires env:** `GROQ_API_KEY`  
**Model:** `llama-3.3-70b-versatile` (via Groq) — configurable via request context

Streams AI chat completions. Implements Server-Sent Events (SSE) / text-stream format compatible with the Vercel AI SDK.

**Request body:**

```ts
{
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  context?: {
    mode?: string;        // e.g. "design", "code", "audit"
    profile?: object;     // PluginProfile for model selection
  };
}
```

**Constraints:**
- Last message must have `role: "user"`.
- `maxOutputTokens`: 8192. Temperature: 0.7.

**Success response (200):** Text stream (chunked transfer encoding). Each chunk is a partial completion delta as plain text.

**Error codes:**

| Status | Cause |
|---|---|
| 400 | Invalid JSON or missing user message |
| 429 | Rate limit exceeded |
| 500 | `GROQ_API_KEY` not configured or Groq API error |

**Consuming the stream (client):**

```ts
const res = await fetch("/api/chat-stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages }),
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}
```

---

### POST /api/analyze-image

**Runtime:** Vercel Node.js serverless  
**Rate limit:** 20 requests / 60 s per IP (in-memory sliding window)  
**Requires env:** `GROQ_API_KEY`  
**Vision model:** `meta-llama/llama-4-scout-17b-16e-instruct`

Analyzes a UI screenshot (base64-encoded) to detect layout patterns and match against template metadata.

**Request body:**

```ts
{
  base64Image:    string;                          // Required. Base64-encoded image data.
  mimeType:       "image/png" | "image/jpeg" | "image/webp"; // Required.
  contextSummary?: string;                         // Optional description to improve matching.
  templateMeta:   Array<{                          // Required. At least one entry.
    id:       string;
    category: string;
    priority: string;
    keywords: string[];
  }>;
}
```

**Success response (200):**

```json
{
  "layoutPattern": {
    "columns": 2,
    "navPosition": "left",
    "cardStyle": "grid",
    "colorScheme": "dark",
    "density": "comfortable"
  },
  "top3": [
    {
      "templateId": "dashboard-admin",
      "score": 85,
      "matchReason": "sidebar dashboard/admin layout; context matched admin, dashboard"
    },
    {
      "templateId": "saas-sidebar",
      "score": 70,
      "matchReason": "left navigation fits technical UI"
    },
    {
      "templateId": "analytics-dark",
      "score": 55,
      "matchReason": "context matched analytics"
    }
  ]
}
```

**Field definitions (layoutPattern):**

| Field | Values | Description |
|---|---|---|
| `columns` | `1`, `2`, `3`, `"sidebar"` | Column count detected |
| `navPosition` | `"top"`, `"left"`, `"none"` | Navigation bar position |
| `cardStyle` | `"list"`, `"grid"`, `"table"`, `"kanban"` | Content presentation style |
| `colorScheme` | `"light"`, `"dark"` | Color scheme |
| `density` | `"compact"`, `"comfortable"`, `"spacious"` | Information density |

**Error codes:**

| Status | Cause |
|---|---|
| 400 | Missing `base64Image`, invalid `mimeType`, or empty `templateMeta` |
| 405 | Non-POST request |
| 429 | Rate limit exceeded |
| 500 | `GROQ_API_KEY` not configured or vision model error |

---

## 4. Agent System

The agent system lives in `web/src/ux-checklist/agents/`. All agents extend `BaseAgent` from `agents/types.ts` and integrate with the Shannon Engine orchestrator.

### Agent Interface

**`BaseAgent`** — Abstract base class. Provides timing, error wrapping, and a standard `execute()` envelope.

```ts
abstract class BaseAgent {
  abstract readonly id: string;
  abstract readonly role: AgentRole;         // "analyzer" | "generator" | "validator" | "optimizer" | "orchestrator"
  abstract readonly capabilities: string[];
  abstract readonly description: string;

  readonly timeoutMs = 30_000;    // 30 s default
  readonly maxConcurrency = 1;

  async execute(input: unknown, context: AgentContext): Promise<AgentExecutionResult>;
  protected abstract run(input: unknown, context: AgentContext): Promise<{
    output: unknown;
    confidence: number;
    tokensUsed: number;
    evidenceRefs: string[];
  }>;

  toConfig(): AgentConfig;
}
```

**`AgentConfig`** — Registration metadata for the Shannon Engine:

```ts
interface AgentConfig {
  id: string;
  role: AgentRole;
  capabilities: string[];
  description: string;
  maxConcurrency: number;
  timeoutMs: number;
}
```

**`AgentContext`** — Shared context passed to each agent at execution time:

```ts
interface AgentContext {
  projectName: string;
  criteria: AuditCriterion[];
  previousResults?: AuditResult[];
  metadata?: Record<string, unknown>;
}
```

**`AgentExecutionResult`** — Standardized output envelope:

```ts
interface AgentExecutionResult {
  agentId: string;
  success: boolean;
  output: unknown;       // Typed by each agent (e.g. AuditResult[], FixPlan[], GitHubIssuePayload[])
  confidence: number;    // 0–1
  tokensUsed: number;
  latencyMs: number;
  evidenceRefs: string[];
}
```

On failure, `success` is `false` and `output` is `{ error: string }`. The agent never throws from `execute()`.

---

### Built-in Agents

#### `DesignAuditAgent`

| Property | Value |
|---|---|
| `id` | `"design-audit-agent"` |
| `role` | `"analyzer"` |
| `capabilities` | `layout-scoring`, `pattern-detection`, `interaction-audit`, `visual-hierarchy`, `component-state-check` |

Scores UI/UX designs against checklist criteria for layout, interaction patterns, and visual hierarchy.

- **Input:** `ScanResult` or `SerializedNode` data
- **Output:** `AuditResult[]`
- **Categories handled:** `layout`, `responsive`, `animation`, `navigation`, `button`, `input`, `card`, `modal`, `feedback`, `loading`, `error-state`, `pattern`, `element`, `interaction`

```ts
const agent = new DesignAuditAgent();
const result = await agent.execute(scanData, { projectName: "app", criteria });
const scores = result.output as AuditResult[];
```

---

#### `AccessibilityAgent`

| Property | Value |
|---|---|
| `id` | `"accessibility-agent"` |
| `role` | `"validator"` |
| `capabilities` | `contrast-check`, `touch-target-validation`, `aria-label-audit`, `keyboard-nav-check`, `focus-indicator-validation`, `heading-hierarchy`, `reduced-motion-check` |

Validates WCAG compliance: contrast ratios (4.5:1 AA minimum), touch targets (24 px WCAG 2.5.8), ARIA labels, keyboard navigation, and focus indicators.

- **Input:** `SerializedNode` or `AccessibilityAudit` data
- **Output:** `AuditResult[]`
- **Categories handled:** `contrast`, `touch-target`, `aria`, `accessibility`, `screen-reader`, and all criteria with a `wcagRef`

```ts
const agent = new AccessibilityAgent();
const result = await agent.execute(nodeData, { projectName: "app", criteria });
const issues = result.output as AuditResult[];
```

---

#### `DesignSystemAgent`

| Property | Value |
|---|---|
| `id` | `"design-system-agent"` |
| `role` | `"analyzer"` |
| `capabilities` | `token-coverage-analysis`, `component-naming-validation`, `variant-completeness-check`, `spacing-grid-compliance`, `elevation-token-check`, `typography-scale-validation` |

Validates token coverage, component naming conventions, variant completeness, and spacing grid compliance. Grid base unit is 4 px with ±1 px tolerance.

- **Input:** Component tree data
- **Output:** `AuditResult[]`
- **Categories handled:** `foundation`, `color`, `typography`, `spacing`, `elevation`

```ts
const agent = new DesignSystemAgent();
const result = await agent.execute(componentTree, { projectName: "ds", criteria });
```

---

#### `FixPlannerAgent`

| Property | Value |
|---|---|
| `id` | `"fix-planner-agent"` |
| `role` | `"optimizer"` |
| `capabilities` | `fix-plan-generation`, `effort-estimation`, `risk-assessment`, `automation-detection`, `dependency-analysis` |

Creates prioritized, safe fix plans from failed audit results. Each plan estimates effort (minutes) and risk, and flags whether the fix can be automated.

- **Input:** `AuditResult[]` (failed results)
- **Output:** `FixPlan[]`

```ts
interface FixPlan {
  criterionId: string;
  title: string;
  steps: FixPlanStep[];       // Ordered steps; each has action, target, risk
  estimatedMinutes: number;
  automated: boolean;
  codeChanges?: Array<{ file: string; description: string }>;
}

interface FixPlanStep {
  action: string;             // e.g. "increase contrast ratio"
  target: string;             // e.g. "Button.primary background"
  risk: "low" | "medium" | "high";
}
```

Risk mapping by severity: `critical → high`, `major → medium`, `minor/info → low`.

```ts
const agent = new FixPlannerAgent();
const result = await agent.execute(failedResults, { projectName: "app", criteria });
const plans = result.output as FixPlan[];
```

---

#### `IssueWriterAgent`

| Property | Value |
|---|---|
| `id` | `"issue-writer-agent"` |
| `role` | `"generator"` |
| `capabilities` | `github-issue-generation`, `acceptance-criteria-writing`, `evidence-attachment`, `label-inference`, `priority-mapping` |

Transforms failed audit criteria into structured GitHub issue payloads ready to be sent to `POST /api/github/create-checklist-issues`.

- **Input:** `AuditResult[]` (failed results)
- **Output:** `GitHubIssuePayload[]`

```ts
interface GitHubIssuePayload {
  title: string;
  body: string;               // Markdown
  labels: string[];
  priority: "critical" | "high" | "medium" | "low";
  acceptanceCriteria: string[];
  evidence: Array<{ type: "screenshot" | "node" | "selector"; ref: string }>;
}
```

```ts
const agent = new IssueWriterAgent();
const result = await agent.execute(failedResults, { projectName: "app", criteria });
const issues = result.output as GitHubIssuePayload[];
```

---

### Creating Custom Agents

1. Extend `BaseAgent` from `web/src/ux-checklist/agents/types.ts`.
2. Implement the four abstract readonly properties and the `run()` method.
3. Return the standard `{ output, confidence, tokensUsed, evidenceRefs }` shape from `run()`.
4. Register with the Shannon Engine via `agent.toConfig()`.

```ts
import { BaseAgent } from "./types";
import type { AgentRole, AgentContext } from "./types";

export class MyCustomAgent extends BaseAgent {
  readonly id = "my-custom-agent";
  readonly role: AgentRole = "analyzer";
  readonly capabilities = ["custom-check"];
  readonly description = "Validates custom design rules.";

  // Optional overrides
  readonly timeoutMs = 15_000;   // 15 s
  readonly maxConcurrency = 2;

  protected async run(input: unknown, context: AgentContext) {
    // Your logic here
    const output = { findings: [] };
    return {
      output,
      confidence: 0.9,
      tokensUsed: 0,
      evidenceRefs: [],
    };
  }
}

// Register with orchestrator
const agent = new MyCustomAgent();
shannonEngine.registerAgent(agent.toConfig());
```

**Important:** `run()` must not throw. Catch all errors internally and return low confidence results. `execute()` in `BaseAgent` will catch uncaught exceptions and return `success: false` with zero confidence.

---

## 5. UX Checklist Orchestrator

**Source:** `web/src/ux-checklist/index.ts`

The orchestrator is a self-learning pipeline with five components: `CriteriaRegistry`, `EvidenceMemoryEngine`, `GOAPPlanner`, `LearningLoop`, and `DesignAnalyzer`.

### CriteriaRegistry

Manages evidence-weighted audit criteria. Criteria are not static rows — they evolve through user validation.

```ts
class CriteriaRegistry {
  constructor(evidenceEngine: EvidenceMemoryEngine);

  // Register a single criterion
  register(criterion: AuditCriterion): void;

  // Bulk register from a standard (wcag, material3, vts, etc.)
  registerBulk(criteria: AuditCriterion[]): void;

  // Get active criteria filtered by config (sorted by confidence × learnedWeight)
  getActive(config: ChecklistConfig): AuditCriterion[];

  // Boost or reduce criterion confidence based on user validation
  validate(id: string, positive: boolean): void;

  // Find semantically similar criteria via HNSW search
  async findSimilar(query: string, topK?: number): Promise<AuditCriterion[]>;

  // Detect criteria that contradict each other across different standards
  detectContradictions(): Array<{ a: AuditCriterion; b: AuditCriterion; similarity: number }>;
}
```

**`AuditCriterion` structure:**

```ts
interface AuditCriterion {
  id: string;
  title: string;
  description: string;
  source: "vts" | "ant-design" | "material3" | "wcag" | "custom" | "ai-inferred";
  category: AuditCategory;    // "foundation" | "color" | "typography" | ... | "error-state"
  severity: "critical" | "major" | "minor" | "info";
  confidence: number;         // 0–1, evidence-backed
  validationCount: number;
  tags: string[];
  automatable: boolean;
  wcagRef?: string;           // e.g. "2.5.8"
  learnedWeight: number;      // 0.1–2.0, adjusted by feedback
}
```

Validation mechanics:
- Positive validation: confidence `+0.05`, learnedWeight `+0.02` (capped at 1.0 / 2.0 respectively).
- Negative validation: confidence `−0.03`, learnedWeight `−0.05` (floored at 0.1 / 0.1 respectively).

---

### LearningLoop

The learning system spans two classes: `ProjectMemory` (per-project history) and `CrossProjectLearning` (cross-project aggregation).

**`ProjectMemory`:**

```ts
class ProjectMemory {
  addEntry(entry: ProjectMemoryEntry): void;
  getEntriesForProject(projectId: string): ProjectMemoryEntry[];
  getLatest(projectId: string): ProjectMemoryEntry | null;
  getWeightHistory(projectId: string, criterionId: string): number[];
}
```

**`CrossProjectLearning`:**

```ts
class CrossProjectLearning {
  // Exponential decay: 30-day half-life, more recent projects weighted higher
  aggregateWeights(projects: ProjectMemoryEntry[]): Map<string, number>;

  // Detect recurring failures (≥50% rejection, ≥3 occurrences)
  // and team preferences (≥70% acceptance, ≥3 occurrences)
  detectPatterns(projects: ProjectMemoryEntry[]): LearningPattern[];

  // Suggest criteria for a project type: "e-commerce", "saas-dashboard", "mobile-app"
  suggestCriteria(projectType: string): AuditCriterion[];

  exportKnowledge(projects: ProjectMemoryEntry[], patterns: LearningPattern[]): KnowledgeSnapshot;
}
```

---

### Running an Audit

Default configuration:

```ts
const DEFAULT_CHECKLIST_CONFIG: ChecklistConfig = {
  enableLearning: true,
  enableAutoPlan: true,
  autoPassThreshold: 0.85,  // Confidence above this → auto-pass
  decayRate: 0.03,           // Knowledge half-life
  maxCriteriaPerRun: 50,
  activeSources: ["vts", "ant-design", "material3", "wcag"],
  minSeverity: "minor",
};
```

**Audit flow:**

1. `CriteriaRegistry.getActive(config)` retrieves and ranks criteria.
2. `GOAPPlanner` generates an optimal audit sequence (high-impact first).
3. Specialized agents (`DesignAuditAgent`, `AccessibilityAgent`, `DesignSystemAgent`) evaluate their categories in parallel.
4. `FixPlannerAgent` creates fix plans for all failures.
5. `IssueWriterAgent` formats GitHub issue payloads.
6. Results are stored in `EvidenceMemoryEngine` for future learning.

---

## 6. Evidence Memory

**Source:** `web/src/lib/evidenceMemory.ts`

A production-grade memory engine for storing and recalling design evidence. Uses HNSW for O(log n) semantic search and sigmoid confidence decay.

### Storing Evidence

```ts
class EvidenceMemoryEngine {
  configure(config: EvidenceMemoryConfig): void;

  async storeEvidence(record: Omit<EvidenceRecord, "id" | "createdAt" | "lastAccessedAt" | "accessCount">): Promise<string>;
}

interface EvidenceRecord {
  content: string;
  source: "design-file" | "user-feedback" | "ai-inference" | "pattern-match";
  confidence: number;     // 0.0–1.0
  validated: boolean;
  validatedBy?: "design-file" | "user-feedback" | "developer";
  validatedAt?: number;
  contradictions: string[];
  tags: string[];
  metadata: Record<string, unknown>;
}
```

**Example:**

```ts
const engine = new EvidenceMemoryEngine();
engine.configure({ decayRatePerDay: 0.05, maxRecords: 10000 });

const id = await engine.storeEvidence({
  content: "Button contrast ratio is 2.1:1 — fails WCAG AA",
  source: "ai-inference",
  confidence: 0.9,
  validated: false,
  contradictions: [],
  tags: ["contrast", "button", "wcag"],
  metadata: { nodeId: "1:42", criterionId: "a11y-contrast-4.5" },
});
```

Source hierarchy (higher rank = more authoritative): `design-file (4) > user-feedback (3) > ai-inference (2) > pattern-match (1)`.

---

### Querying (HNSW search)

```ts
async recallEvidence(
  query: string,
  options?: {
    minConfidence?: number;    // default: configured minConfidenceThreshold (0.3)
    onlySources?: EvidenceSource[];
    onlyValidated?: boolean;
    limit?: number;            // default 50
  }
): Promise<EvidenceRecord[]>;
```

When `enableVectorSearch: true` (default), the engine embeds the query into a 128-dimension vector and performs HNSW approximate nearest-neighbor search (`efSearch = 50`). Results are then filtered by confidence and source, and ranked by recency × source hierarchy.

**Example:**

```ts
const results = await engine.recallEvidence("contrast ratio failure buttons", {
  minConfidence: 0.5,
  onlySources: ["design-file", "user-feedback"],
  onlyValidated: true,
  limit: 10,
});
```

---

### Snapshot Import/Export

The `CrossProjectLearning.exportKnowledge()` method produces a `KnowledgeSnapshot`:

```ts
interface KnowledgeSnapshot {
  version: number;
  exportedAt: number;
  projects: ProjectMemoryEntry[];
  patterns: LearningPattern[];
  globalWeights: Record<string, number>;
}
```

Snapshots can be used for:
- Cross-team knowledge sharing (export from team A, import into team B).
- Backup and restore of accumulated learning.
- Seeding a new workspace with domain-specific patterns.

`MemoryPersistence` handles localStorage (default) and can be extended for Supabase remote sync by implementing `syncToRemote()` and `importFromRemote()` (requires `SUPABASE_URL` and `SUPABASE_KEY`).

---

## 7. Permissions (RBAC)

**Source:** `shared/permissions/`

Role-based access control inspired by n8n's `@n8n/permissions` package. Two-tier model: global workspace roles and per-project roles.

### Roles and Scopes

**Global roles** (workspace level, hierarchical — each role includes all scopes of roles below it):

| Role | Description |
|---|---|
| `owner` | Full access including billing management |
| `admin` | All access except `billing:manage` |
| `member` | Read + write, no management |
| `viewer` | Read-only across all resources |
| `guest` | Minimal read-only (projects, designs, issues) |

**Project roles** (per-project, combine with global role via `combineScopes()`):

| Role | Description |
|---|---|
| `project:owner` | Full project control |
| `project:editor` | Full read/write within project |
| `project:reviewer` | Can create/close issues and run audits |
| `project:viewer` | Read-only within project |

**Available scopes:**

```
project:read    project:write    project:delete   project:manage
audit:read      audit:write      audit:execute
issue:read      issue:create     issue:close
design:read     design:write     design:export
agent:read      agent:configure  agent:execute
team:read       team:manage      team:invite
billing:read    billing:manage
settings:read   settings:write
```

---

### Usage Examples

```ts
import {
  hasScope, hasAllScopes, hasAnyScope,
  combineScopes, checkPermission, getResourcePermissions,
  getRoleScopes,
} from "@shared/permissions";

// Check a single scope
hasScope("member", "audit:execute");  // true
hasScope("viewer", "audit:execute");  // false

// Check all scopes required for an operation
hasAllScopes("admin", ["project:delete", "team:manage"]);  // true

// Check if any of a list of scopes is present
hasAnyScope("member", ["billing:manage", "design:export"]);  // true (design:export)

// Combine global + project role scopes (union, deduplicated)
const scopes = combineScopes("member", "project:owner");
// Returns member's scopes UNION project:owner's scopes

// Full permission check with missing scopes list
const check = checkPermission("viewer", ["audit:execute", "design:write"]);
// { allowed: false, missingScopes: ["audit:execute", "design:write"], role: "viewer" }

// CRUD map for a resource prefix
const perms = getResourcePermissions("member", "audit");
// { read: true, write: true, delete: false, manage: false, execute: true }
```

---

## 8. JSON Schema to Zod

**Source:** `shared/lib/jsonSchemaToZod.ts`

Runtime converter from JSON Schema Draft 7 to Zod v4 schemas. Inspired by n8n's `@n8n/json-schema-to-zod`.

### Runtime Schema Conversion

```ts
import { jsonSchemaToZod } from "@shared/lib";

const zodSchema = jsonSchemaToZod(
  {
    type: "object",
    properties: {
      name:  { type: "string", minLength: 1 },
      age:   { type: "integer", minimum: 0, maximum: 150 },
      email: { type: "string", format: "email" },
      role:  { type: "string", enum: ["admin", "member", "viewer"] },
    },
    required: ["name", "email"],
  }
);

zodSchema.parse({ name: "Alice", email: "alice@example.com" }); // OK
zodSchema.parse({ name: "", email: "alice@example.com" });      // ZodError: too_small
```

**With `$ref` resolution:**

```ts
const schema = jsonSchemaToZod(
  {
    type: "object",
    properties: {
      address: { $ref: "#/definitions/Address" },
    },
    definitions: {
      Address: {
        type: "object",
        properties: {
          street: { type: "string" },
          city:   { type: "string" },
        },
        required: ["city"],
      },
    },
  }
);
```

**Passing external definitions:**

```ts
const schema = jsonSchemaToZod(
  { $ref: "#/definitions/MyType" },
  { MyType: { type: "string", format: "uuid" } }
);
```

---

### Supported Types

| JSON Schema | Zod Output | Notes |
|---|---|---|
| `type: "string"` | `z.string()` | `minLength`, `maxLength`, `pattern`, `format` (email/url/uuid) applied |
| `type: "number"` | `z.number()` | `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` |
| `type: "integer"` | `z.number().int()` | Same constraints as number |
| `type: "boolean"` | `z.boolean()` | |
| `type: "null"` | `z.null()` | |
| `type: "array"` | `z.array(itemSchema)` | `minItems`, `maxItems`, `uniqueItems` |
| `type: "object"` | `z.object(shape)` | Non-required fields become `.optional()` |
| `type: ["string", "null"]` | `z.string().nullable()` | Nullable type array |
| `enum: [...]` | `z.enum([...])` or `z.union([...])` | String arrays use `z.enum`; mixed use union of literals |
| `const: value` | `z.literal(value)` | |
| `oneOf: [...]` | `z.union([...])` | |
| `anyOf: [...]` | `z.union([...])` | |
| `allOf: [...]` | `z.intersection(...)` | Chained via `.and()` |
| `$ref: "#/definitions/X"` | Resolved recursively | Local refs only; both `#/definitions/` and `#/$defs/` supported |
| `nullable: true` | `.nullable()` appended | OpenAPI-style extension |
| `description` | `.describe(text)` | |
| `default` | `.default(value)` | |
| (no type) | `z.unknown()` | |

**Limitations:**
- Only local `$ref` values are supported (`#/definitions/Name` or `#/$defs/Name`). External URIs throw.
- Tuple-style `items` arrays (JSON Schema draft 4 tuples) fall back to `z.array(z.unknown())`.
- `additionalProperties` is not enforced (Zod objects are open by default).
- Unknown JSON Schema types throw `Error: jsonSchemaToZod: unsupported JSON Schema type "..."`.
