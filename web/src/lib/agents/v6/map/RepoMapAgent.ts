/**
 * RepoMapAgent — indexes the repository structure for all other agents.
 *
 * Scans the repo and produces a structured map:
 *   - Source files by directory (ts/tsx/scss/css)
 *   - Exported symbols per file (components, functions, types)
 *   - Package.json dependencies
 *   - Route definitions (file-based or explicit)
 *   - Design token files / variable references
 *
 * Deterministic v0 — no LLM. Uses fast regex + fs scanning.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RepoMapInput {
  /** Root directories to scan (relative to repoRoot). Default: ["src", "ui", "web", "api", "shared"] */
  roots?: string[];
  /** Max depth for directory traversal. Default: 8 */
  maxDepth?: number;
}

export interface FileEntry {
  path: string;           // repo-relative
  ext: string;            // ".ts" | ".tsx" etc
  exports: string[];      // named exports
  imports: string[];      // import paths (relative only)
  loc: number;            // line count
  isComponent: boolean;   // has JSX/TSX default or named component export
  isTest: boolean;        // *.test.* or *.spec.*
  isStory: boolean;       // *.stories.*
}

export interface DependencyInfo {
  name: string;
  version: string;
  isDev: boolean;
}

export interface RepoMapOutput {
  /** All source files indexed */
  files: FileEntry[];
  /** Dependencies from package.json */
  dependencies: DependencyInfo[];
  /** Component files (isComponent=true) */
  components: FileEntry[];
  /** Test files */
  tests: FileEntry[];
  /** Files with design token references */
  tokenFiles: string[];
  /** Directory tree summary: { "src/lib": 42, "ui/components": 15 } */
  dirCounts: Record<string, number>;
  /** Total stats */
  stats: {
    totalFiles: number;
    totalLoc: number;
    totalComponents: number;
    totalTests: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".scss", ".css"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".worktrees", ".claude", ".next", ".storybook"]);

const EXPORT_RE = /export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g;
const IMPORT_RE = /import\s+.*?from\s+["'](\.[^"']+)["']/g;
const COMPONENT_RE = /export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w+)/;
const TOKEN_RE = /var\(--dr-|designToken|design-token|\.module\.scss|\.module\.css/;

export class RepoMapAgent extends BaseAgentV6<RepoMapInput, RepoMapOutput> {
  readonly id = "map.repo-map";
  readonly name = "Repo Map";
  readonly fleet: FleetName = "map";
  readonly role = "analyzer" as const;
  readonly description = "Indexes repository structure, exports, dependencies, and design tokens";

  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    super();
    this.repoRoot = repoRoot;
  }

  protected async run(
    input: RepoMapInput,
    ctx: AgentContextV6,
  ): Promise<{ output: RepoMapOutput }> {
    const roots = input.roots ?? ["src", "ui", "web", "api", "shared"];
    const maxDepth = input.maxDepth ?? 8;

    const files: FileEntry[] = [];
    const dirCounts: Record<string, number> = {};
    const tokenFiles: string[] = [];

    for (const root of roots) {
      const rootPath = join(this.repoRoot, root);
      try {
        await stat(rootPath);
      } catch {
        continue; // root doesn't exist
      }
      await this.scanDir(rootPath, root, 0, maxDepth, files, dirCounts, tokenFiles);
    }

    // Parse package.json
    const dependencies = await this.parseDependencies();

    const components = files.filter((f) => f.isComponent);
    const tests = files.filter((f) => f.isTest);

    const stats = {
      totalFiles: files.length,
      totalLoc: files.reduce((sum, f) => sum + f.loc, 0),
      totalComponents: components.length,
      totalTests: tests.length,
    };

    ctx.logger.info(
      `[repo-map] indexed ${stats.totalFiles} files, ${stats.totalLoc} LOC, ${stats.totalComponents} components`,
    );

    return {
      output: { files, dependencies, components, tests, tokenFiles, dirCounts, stats },
    };
  }

  private async scanDir(
    absPath: string,
    relPath: string,
    depth: number,
    maxDepth: number,
    files: FileEntry[],
    dirCounts: Record<string, number>,
    tokenFiles: string[],
  ): Promise<void> {
    if (depth > maxDepth) return;

    let entries: string[];
    try {
      entries = await readdir(absPath);
    } catch {
      return;
    }

    let dirFileCount = 0;
    for (const entry of entries) {
      const fullPath = join(absPath, entry);
      const entryRel = relPath ? `${relPath}/${entry}` : entry;

      let s;
      try {
        s = await stat(fullPath);
      } catch {
        continue;
      }

      if (s.isDirectory()) {
        if (SKIP_DIRS.has(entry)) continue;
        await this.scanDir(fullPath, entryRel, depth + 1, maxDepth, files, dirCounts, tokenFiles);
      } else if (s.isFile()) {
        const ext = extname(entry);
        if (!SOURCE_EXTS.has(ext)) continue;

        const fileEntry = await this.parseFile(fullPath, entryRel, ext);
        files.push(fileEntry);
        dirFileCount++;

        if (fileEntry.exports.some(() => false) || tokenFiles.length >= 0) {
          // Check token references
          try {
            const content = await readFile(fullPath, "utf8");
            if (TOKEN_RE.test(content)) {
              tokenFiles.push(entryRel);
            }
          } catch {
            // ignore
          }
        }
      }
    }

    if (dirFileCount > 0) {
      dirCounts[relPath] = (dirCounts[relPath] ?? 0) + dirFileCount;
    }
  }

  private async parseFile(fullPath: string, relPath: string, ext: string): Promise<FileEntry> {
    const name = basename(relPath);
    const isTest = /\.(test|spec)\.[tj]sx?$/.test(name);
    const isStory = /\.stories\.[tj]sx?$/.test(name);

    let content: string;
    try {
      content = await readFile(fullPath, "utf8");
    } catch {
      return { path: relPath, ext, exports: [], imports: [], loc: 0, isComponent: false, isTest, isStory };
    }

    const lines = content.split("\n");
    const loc = lines.length;

    // Extract exports
    const exports: string[] = [];
    let match: RegExpExecArray | null;
    EXPORT_RE.lastIndex = 0;
    while ((match = EXPORT_RE.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Extract relative imports
    const imports: string[] = [];
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Detect components (PascalCase export in .tsx or .jsx)
    const isComponent = (ext === ".tsx" || ext === ".jsx") && COMPONENT_RE.test(content);

    return { path: relPath, ext, exports, imports, loc, isComponent, isTest, isStory };
  }

  private async parseDependencies(): Promise<DependencyInfo[]> {
    const deps: DependencyInfo[] = [];
    try {
      const raw = await readFile(join(this.repoRoot, "package.json"), "utf8");
      const pkg = JSON.parse(raw);
      for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
        deps.push({ name, version: String(version), isDev: false });
      }
      for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
        deps.push({ name, version: String(version), isDev: true });
      }
    } catch {
      // no package.json
    }
    return deps;
  }
}
