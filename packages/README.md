# Monorepo Migration Plan

## Current: Single Package
All code lives in root package.json.

## Target: Workspace Packages

| Package | Source | Description |
|---------|--------|-------------|
| @desygn/shared | shared/ | Types, schemas, utilities |
| @desygn/plugin | plugin/ + ui/ | Figma plugin sandbox |
| @desygn/web | web/ | Web workspace application |
| @desygn/api | api/ | Vercel serverless functions |
| @desygn/auditor | web/src/ux-checklist/ | UX audit engine + agents |

## Migration Steps
1. ✅ Turborepo config (turbo.json)
2. ✅ pnpm workspace definition
3. 🔲 Extract @desygn/shared (lowest risk — no runtime deps)
4. 🔲 Extract @desygn/auditor (self-contained module)
5. 🔲 Extract @desygn/api (serverless functions)
6. 🔲 Extract @desygn/plugin (Figma-specific)
7. 🔲 Extract @desygn/web (main application)
