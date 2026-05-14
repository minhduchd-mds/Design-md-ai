# Design-md-ai

> Figma-to-Design.md handoff tool for AI coding agents.  
> Scan design systems, generate structured specs, and prepare prompts for Codex, Claude Code, Cursor, Windsurf, and Figma Make.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)]()
[![Vercel](https://img.shields.io/badge/deploy-Vercel-black.svg)](https://design-md-ai.vercel.app/)

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Features](#features)
- [Getting Started](#getting-started)
- [Scripts Reference](#scripts-reference)
- [Figma Plugin Setup](#figma-plugin-setup)
- [Web Workspace](#web-workspace)
- [API Routes](#api-routes)
- [Template Library](#template-library)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Testing & Quality](#testing--quality)
- [Current Limitations](#current-limitations)
- [License](#license)

---

## Overview

Design-md-ai bridges the gap between design context and code generation. It provides two user-facing surfaces:

| Surface | Purpose |
|---------|---------|
| **Figma Plugin** | Scan components, variables, responsive variants, and score AI-readiness |
| **Web Workspace** | Generate Design.md, chat with Groq AI, preview handoffs, and use the template library |

---

## Project Structure

```
Design-md-ai/
├── api/                            # Vercel serverless functions
│   ├── chat.ts                     #   Groq AI chat endpoint
│   ├── generate-html.ts            #   HTML generation from prompts
│   ├── generate-screens.ts         #   Screen generation endpoint
│   ├── analyze-image.ts            #   Image analysis endpoint
│   ├── bootstrap-context.ts        #   Context bootstrapping
│   └── lib/
│       └── sanitize.ts             #   Input sanitization utilities
│
├── plugin/                         # Figma plugin controller (no DOM, no fetch)
│   ├── code.ts                     #   Plugin entry point
│   ├── serializer.ts               #   Node serialization with isMixed() checks
│   ├── types.ts                    #   Plugin-specific types
│   └── handlers/
│       ├── autolayout.ts           #   Auto-layout analysis
│       ├── figma-import.ts         #   Figma import handler
│       ├── fixes.ts                #   Design fix suggestions
│       ├── profiles.ts             #   Scan profiles
│       ├── project-frame.ts        #   Project frame creation
│       ├── selection.ts            #   Selection handler
│       └── __tests__/              #   Handler unit tests
│
├── shared/                         # Shared code (plugin + web)
│   ├── types.ts                    #   SerializedNode, PluginMessage types
│   ├── constants.ts                #   Shared constants
│   ├── designContext.ts            #   DesignContext type & factory
│   ├── viewport.ts                 #   Viewport classification utils
│   ├── sanitize.ts                 #   Shared sanitization
│   └── __tests__/                  #   Shared unit tests
│
├── ui/                             # Figma plugin React UI (iframe, no figma.*)
│   ├── main.tsx                    #   UI entry point
│   ├── App.tsx                     #   Root component
│   ├── components/                 #   30+ UI components with CSS Modules
│   │   ├── ScoreOverview.tsx       #     AI-readiness score display
│   │   ├── BatchPanel.tsx          #     Batch scan panel
│   │   ├── ExportHub.tsx           #     Export options panel
│   │   ├── FixPanel.tsx            #     Design fix suggestions
│   │   ├── TokenMap.tsx            #     Token mapping display
│   │   ├── ProfileManager.tsx      #     Scan profile management
│   │   └── ...                     #     (+ 24 more components)
│   ├── hooks/                      #   Custom React hooks
│   ├── lib/                        #   Scanner, scoring, prompt generation
│   ├── i18n/                       #   Internationalization
│   ├── styles/                     #   Global CSS & tokens
│   ├── tokens/                     #   Dark/Light design tokens (JSON)
│   └── docs/                       #   Component documentation
│
├── web/                            # Public web workspace
│   └── src/
│       ├── main.tsx                #   App entry (auth, workspace, chat)
│       ├── styles.css              #   Global styles (dark/light theme)
│       ├── app/
│       │   └── types.ts            #   App-level TypeScript types
│       ├── design/
│       │   ├── templateRegistry.ts #   73 template registry + metadata
│       │   ├── designParser.ts     #   Design.md parser & builder
│       │   ├── contextBuilder.ts   #   Design context builder
│       │   ├── layoutValidator.ts  #   Layout validation & scoring
│       │   ├── screenGenerator.ts  #   Screen generation logic
│       │   ├── templateMatcher.ts  #   Template matching engine
│       │   ├── constants.ts        #   Design constants
│       │   └── __tests__/          #   Design module tests
│       ├── design-md-templates/    #   73 stored DESIGN.md templates
│       │   ├── airtable/
│       │   ├── stripe/
│       │   ├── notion/
│       │   └── .../DESIGN.md       #   Each template has its own folder
│       ├── workspace/
│       │   ├── ChatComposer.tsx    #   Chat input with tab-aware controls
│       │   ├── SplitView.tsx       #   Split view editor
│       │   ├── HtmlPreviewModal.tsx#   HTML preview modal
│       │   ├── claudeChat.ts       #   Groq AI chat client
│       │   ├── fileImport.ts       #   Markdown/ZIP import
│       │   ├── imageAnalyzer.ts    #   Image analysis client
│       │   └── screenshotToCode.ts #   Screenshot-to-code WebSocket client
│       └── lib/
│           ├── requestCache.ts     #   Request caching
│           └── supabase.ts         #   Supabase client config
│
├── supabase/                       # Supabase config
│   ├── functions/
│   │   └── analyze-image/          #   Edge function for image analysis
│   └── migrations/
│       └── 001_project_versions.sql
│
├── manifest.json                   # Figma plugin manifest
├── package.json                    # Dependencies & scripts
├── vercel.json                     # Vercel deployment & security headers
├── vite.config.ts                  # Figma plugin UI build config
├── vite.web.config.ts              # Web workspace build config
├── vitest.config.ts                # Test configuration
├── tsconfig.json                   # TypeScript config (UI)
└── tsconfig.plugin.json            # TypeScript config (plugin)
```

---

## Features

### Figma Plugin
- Scan selected frames/components and score AI-readiness
- Detect naming, structure, variant, token, completeness, and layout issues
- Batch scan multiple Figma selections
- Read Figma variables, paint styles, components, component sets, pages, instances
- Create project frames inside Figma with mapped components and layout metadata
- Export compact prompts for coding agents

### Web Workspace
- **Chat tab** — Pure Groq AI conversation (Llama 3.3 70B), markdown rendering
- **Code tab** — Design.md generation with full tool suite
- **Dark/Light toggle** for the chat workspace
- Generate Design.md project folders for coding-agent handoff
- 73 Design.md templates with lazy-loading
- Preview with section navigation and light/dark modes
- Edit Design.md inline, save locally, copy, or download
- Import `.md`, `.markdown`, `.txt`, `.zip` files
- Screenshot-to-code generation (requires backend)
- Local demo auth with Web Crypto

### API
- `/api/chat` — Groq AI chat (Llama 3.3 70B Versatile)
- `/api/generate-html` — HTML generation from prompts
- `/api/generate-screens` — Screen generation
- `/api/analyze-image` — Image analysis

---

## Getting Started

### Prerequisites

- **Node.js 20+** (recommended)
- **npm**
- **Figma Desktop** (for plugin development)

### Install

```bash
npm ci
```

### Run Web App

```bash
npm run web:dev
# → http://127.0.0.1:5174
```

### Run Figma Plugin (dev)

```bash
npm run dev
# Watches both plugin UI and controller
```

### Build Everything

```bash
# Web app → public/
npm run web:build

# Figma plugin → dist/
npm run build
```

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode for Figma plugin (UI + controller) |
| `npm run web:dev` | Dev server for web workspace |
| `npm run web:build` | Production build for web app |
| `npm run build` | Production build for Figma plugin |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | ESLint 9 |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type checking (UI + plugin) |
| `npm run storybook` | Storybook dev server |
| `npm run package` | Build + package plugin for release |

---

## Figma Plugin Setup

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Open **Figma Desktop**

3. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (macOS)

4. Search for **Import plugin from manifest**

5. Select this repository's `manifest.json`

6. Open a design file → **Plugins → Development → Design-md-ai**

### Plugin Architecture

```
Plugin sandbox (no DOM)          UI iframe (no figma.*)
┌──────────────────────┐        ┌──────────────────────┐
│  plugin/code.ts      │◄──────►│  ui/main.tsx         │
│  plugin/serializer.ts│ postMsg│  ui/App.tsx           │
│  plugin/handlers/*   │        │  ui/components/*     │
└──────────────────────┘        └──────────────────────┘
         │                                │
         ▼                                ▼
   shared/types.ts              shared/viewport.ts
   (PluginMessage)              (pure utilities)
```

Communication is strictly via typed `PluginMessage` through `postMessage`.

---

## Web Workspace

### Tab System

The workspace has two tabs in the sidebar:

| Tab | Purpose | Features |
|-----|---------|----------|
| **Chat** | Pure Groq AI conversation | Chat input, markdown rendering, no Design.md tools |
| **Code** | Design.md generation | Analyze image, Add BA doc, BA template, Generate 5 screens, category/template pickers |

### Theme

The workspace supports **Dark** (default) and **Light** themes via a toggle button. All workspace elements (messages, composer, action bar, dropdowns, empty state) respond to the theme.

### Auth

Authentication is local-demo only. User records and encrypted data are stored in browser `localStorage` using Web Crypto. Use a real backend auth system for production.

---

## API Routes

All API routes are Vercel serverless functions in the `api/` directory.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | Groq AI chat (requires `GROQ_API_KEY` env) |
| `/api/generate-html` | POST | Generate HTML from text prompt |
| `/api/generate-screens` | POST | Generate screen layouts |
| `/api/analyze-image` | POST | Analyze uploaded image |

---

## Template Library

**73 Design.md templates** stored in `web/src/design-md-templates/`.

Registry: `web/src/design/templateRegistry.ts`

### Template Metadata

Each template includes:
- **`category`** — AI, Developer, Workspace, Product, Commerce, Finance, Automotive, Media
- **`priority`** — Product or Technical
- **`keywords`** — For search matching

### Usage

```bash
npx getdesign@latest add <template-id>
# Example: npx getdesign@latest add airtable
```

Templates are lazy-loaded — only metadata loads at startup, full DESIGN.md content loads on selection.

---

## Deployment

### Vercel Configuration

```json
{
  "buildCommand": "npm run web:build",
  "outputDirectory": "public",
  "installCommand": "npm ci"
}
```

Security headers are configured in `vercel.json`: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.

### Deploy Steps

1. Push to GitHub
2. Import repository in Vercel
3. Set environment variables:
   - `GROQ_API_KEY` — Required for chat functionality
   - `VITE_SCREENSHOT_TO_CODE_WS_URL` — Optional, for screenshot-to-code

### Live

- **App**: [design-md-ai.vercel.app](https://design-md-ai.vercel.app/)
- **Repo**: [github.com/minhduchd-mds/Design-md-ai](https://github.com/minhduchd-mds/Design-md-ai)

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for AI chat |
| `VITE_SCREENSHOT_TO_CODE_WS_URL` | No | WebSocket URL for screenshot-to-code backend |

### Screenshot-to-Code

The client is at `web/src/workspace/screenshotToCode.ts`. It requires a WebSocket backend:

```bash
VITE_SCREENSHOT_TO_CODE_WS_URL=ws://127.0.0.1:7001/generate-code
```

Without this variable, the app shows setup guidance instead.

---

## Testing & Quality

```bash
npm test              # Run all tests (Vitest)
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run lint          # ESLint
npm run format:check  # Check formatting
npm run typecheck     # TypeScript type checking
npm run storybook     # Component playground
```

---

## Current Limitations

- Web auth is local/demo only — not production-ready
- Screenshot-to-code requires a separate backend
- Pro upgrade state is local/demo logic
- Some sidebar sections (My Library, Settings) are marked "Soon"
- Full project ZIP export is not yet implemented

---

## License

[MIT](LICENSE)
