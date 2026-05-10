# Design-md-ai

Design-md-ai is a Figma-to-Design.md handoff tool for AI coding agents. It scans design-system context, generates structured Markdown specifications, and prepares prompts that are easier for Codex, Claude Code, Cursor, Windsurf, and Figma Make to follow.

The project contains two user-facing surfaces:

- A Figma plugin for scanning components, variables, responsive variants, and design readiness.
- A web workspace for generating Design.md, previewing handoff context, importing markdown/ZIP files, and using a growing Design.md template library.

## What It Does

Design-md-ai helps turn design context into implementation context before code generation starts.

Core capabilities:

- Scan selected Figma frames/components and score AI-readiness.
- Detect naming, structure, variant, token, completeness, and layout issues.
- Batch scan multiple Figma selections.
- Read local Figma variables, paint styles, components, component sets, pages, and instances.
- Generate Design.md project folders for coding-agent handoff.
- Export compact prompts for Codex, Claude Code, Cursor, Windsurf, and Figma Make.
- Map design-system components into layout templates such as dashboard, admin table, settings, landing page, mobile app, AI workspace, and developer console.
- Create a project frame back inside Figma with mapped components and layout metadata.
- Import `.md`, `.markdown`, `.txt`, and `.zip` files into the web workspace.
- Use a bundled Design.md template library with 71 templates loaded on demand.
- Preview generated Design.md and copy output from the workspace.
- Store demo accounts and chat history locally with Web Crypto.

## New Features

Recent updates include:

- Brand and product messaging standardized as `Design-md-ai`.
- New landing section: `How it works`.
- 71 Design.md templates imported from `design-md.zip`.
- Template storage added under `web/src/design-md-templates`.
- Template registry added at `web/src/design/templateRegistry.ts`.
- Template markdown is lazy-loaded only when selected, keeping the main web bundle smaller.
- Open Design presets now support dynamic template IDs.
- Sidebar roadmap items now show `Soon` instead of behaving like dead links.
- Output `Copy` action now works.
- SEO metadata added for the web deployment.

## Project Structure

```text
.
|-- plugin/                  # Figma plugin controller and message handlers
|-- shared/                  # Shared TypeScript types and viewport helpers
|-- ui/                      # Figma plugin React UI
|-- web/                     # Public web workspace
|   |-- src/design/          # Design.md parser and template registry
|   |-- src/design-md-templates/
|   |   `-- */DESIGN.md      # 71 stored Design.md templates
|   `-- src/workspace/       # File import and screenshot-to-code client
|-- manifest.json            # Figma plugin manifest
|-- vite.config.ts           # Plugin UI build
|-- vite.web.config.ts       # Web app build
`-- vercel.json              # Vercel deployment config
```

## Requirements

- Node.js 20+ recommended
- npm
- Figma Desktop for local plugin installation
- Optional: a screenshot-to-code WebSocket backend if you want image-to-code generation

## Install Dependencies

```bash
npm ci
```

If you are actively changing dependencies instead of installing from lockfile:

```bash
npm install
```

## Run The Web App Locally

```bash
npm run web:dev
```

Default local URL:

```text
http://127.0.0.1:5174
```

## Build The Web App

```bash
npm run web:build
```

The production output is written to:

```text
dist-web/
```

Vercel is configured to use:

```text
Build command: npm run web:build
Output directory: dist-web
Install command: npm ci
```

## Run The Figma Plugin In Development

Build both the plugin UI and plugin controller in watch mode:

```bash
npm run dev
```

Or run each part separately:

```bash
npm run dev:ui
npm run dev:plugin
```

Build the plugin for Figma:

```bash
npm run build
```

The Figma plugin uses:

- `dist/index.html` for the plugin UI
- `dist/code.js` for the plugin controller

These are referenced by `manifest.json`.

## Install The Figma Plugin Locally

1. Run:

   ```bash
   npm run build
   ```

2. Open Figma Desktop.
3. Press:

   ```text
   Windows: Ctrl + Shift + P
   macOS: Command + Shift + P
   ```

4. Search for:

   ```text
   Import plugin from manifest
   ```

5. Select this repository's `manifest.json`.
6. Open a Figma design file.
7. Run the plugin from:

   ```text
   Plugins -> Development -> DesignReady.ai
   ```

Note: the current manifest name is still `DesignReady.ai`. The product-facing web copy now uses `Design-md-ai`. Rename `manifest.json` if you also want the Figma plugin name to match.

## Web Workspace Usage

The web workspace supports:

- Register/login for a local demo account.
- Enter a product/design request.
- Choose an Open Design preset or one of the imported Design.md templates.
- Generate Design.md output.
- Toggle between Design.md and Preview.
- Copy generated output.
- Upload `.md`, `.markdown`, `.txt`, or ZIP files containing markdown.
- Upload screenshots if a screenshot-to-code backend is configured.
- Restore recent project history from local storage.

Authentication is local-demo only. User records and encrypted profile/chat data are stored in browser `localStorage` using Web Crypto. Use a real backend auth system before handling production users.

## Template Library

Design-md-ai stores 71 Design.md templates in:

```text
web/src/design-md-templates/
```

The registry is defined in:

```text
web/src/design/templateRegistry.ts
```

Templates are exposed in the Open Design dropdown. The app loads only lightweight metadata at startup. Full `DESIGN.md` content is loaded on demand when a user selects a template.

This keeps the main bundle smaller while preserving the full library.

## Screenshot-To-Code Configuration

The screenshot-to-code client is implemented in:

```text
web/src/workspace/screenshotToCode.ts
```

It requires a WebSocket backend URL:

```bash
VITE_SCREENSHOT_TO_CODE_WS_URL=ws://127.0.0.1:7001/generate-code
```

Without this environment variable, the app shows setup guidance instead of generating code from images.

For Vercel, configure the variable in the Vercel dashboard if you have a deployed backend:

```text
Project Settings -> Environment Variables -> VITE_SCREENSHOT_TO_CODE_WS_URL
```

## Testing And Quality

Run unit tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Run formatting:

```bash
npm run format
```

Check formatting only:

```bash
npm run format:check
```

Storybook:

```bash
npm run storybook
```

## Deployment

This repository includes `vercel.json` for the web app. It also sets security headers including CSP, HSTS, frame protection, and permissions policy.

Deploy flow:

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Confirm:

   ```text
   Framework: Vite
   Build command: npm run web:build
   Output directory: dist-web
   Install command: npm ci
   ```

4. Add optional environment variables such as `VITE_SCREENSHOT_TO_CODE_WS_URL`.
5. Deploy.

Live deployment currently targets:

```text
https://design-md-ai.vercel.app/
```

## Current Limitations

- The web auth system is for local/demo use only.
- Screenshot-to-code needs a separate backend.
- Pro upgrade state is currently local/demo logic.
- Some sidebar sections are marked `Soon` and are not full modules yet.
- The Figma plugin manifest name still says `DesignReady.ai`.
- Template search/category filtering is a recommended next improvement for the 71-template library.

## Recommended Next Improvements

- Add search and category filters for Design.md templates.
- Add richer template metadata such as category, source, recommended use case, and visual style.
- Rename the Figma plugin manifest to `Design-md-ai` for full brand consistency.
- Add production backend auth and project persistence.
- Add real project export/download from the web workspace.
- Add a deployed screenshot-to-code backend or hide that feature in production until ready.
- Add screenshots or a short demo video to this README.

## License

MIT
