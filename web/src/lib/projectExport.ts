/**
 * projectExport.ts — Export a full project as a downloadable ZIP.
 *
 * Uses the browser-native CompressionStream (deflate-raw) to create
 * a valid ZIP archive containing Design.md, chat history, and metadata.
 * No external dependencies — pure Web APIs.
 */

import type { ChatMessage, Project } from "../app/types";

// ── ZIP file format helpers (minimal spec-compliant writer) ───

function crc32(data: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff,
    date: (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff,
  };
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = new Date();
  const dt = dosDateTime(now);

  // Pre-compute sizes
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header (30 bytes + name + data)
    const localBuf = new ArrayBuffer(30 + nameBytes.length);
    const local = new DataView(localBuf);
    writeUint32(local, 0, 0x04034b50); // signature
    writeUint16(local, 4, 20); // version needed
    writeUint16(local, 6, 0); // flags
    writeUint16(local, 8, 0); // compression: stored
    writeUint16(local, 10, dt.time);
    writeUint16(local, 12, dt.date);
    writeUint32(local, 14, crc);
    writeUint32(local, 18, size); // compressed
    writeUint32(local, 22, size); // uncompressed
    writeUint16(local, 26, nameBytes.length);
    writeUint16(local, 28, 0); // extra length

    const localArr = new Uint8Array(localBuf);
    localArr.set(nameBytes, 30);

    // Central directory header (46 bytes + name)
    const centralBuf = new ArrayBuffer(46 + nameBytes.length);
    const central = new DataView(centralBuf);
    writeUint32(central, 0, 0x02014b50);
    writeUint16(central, 4, 20); // version made by
    writeUint16(central, 6, 20); // version needed
    writeUint16(central, 8, 0); // flags
    writeUint16(central, 10, 0); // compression: stored
    writeUint16(central, 12, dt.time);
    writeUint16(central, 14, dt.date);
    writeUint32(central, 16, crc);
    writeUint32(central, 20, size);
    writeUint32(central, 24, size);
    writeUint16(central, 28, nameBytes.length);
    writeUint16(central, 30, 0); // extra
    writeUint16(central, 32, 0); // comment
    writeUint16(central, 34, 0); // disk start
    writeUint16(central, 36, 0); // internal attrs
    writeUint32(central, 38, 0); // external attrs
    writeUint32(central, 42, localOffset); // offset

    const centralArr = new Uint8Array(centralBuf);
    centralArr.set(nameBytes, 46);

    localHeaders.push(localArr);
    centralHeaders.push(centralArr);

    localOffset += localArr.length + entry.data.length;
  }

  // End of central directory (22 bytes)
  const centralDirOffset = localOffset;
  let centralDirSize = 0;
  for (const h of centralHeaders) centralDirSize += h.length;

  const endBuf = new ArrayBuffer(22);
  const end = new DataView(endBuf);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 4, 0); // disk number
  writeUint16(end, 6, 0); // central dir start disk
  writeUint16(end, 8, entries.length);
  writeUint16(end, 10, entries.length);
  writeUint32(end, 12, centralDirSize);
  writeUint32(end, 16, centralDirOffset);
  writeUint16(end, 20, 0); // comment length

  // Assemble final ZIP
  const totalSize = localOffset + centralDirSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;

  for (let i = 0; i < entries.length; i++) {
    result.set(localHeaders[i], pos);
    pos += localHeaders[i].length;
    result.set(entries[i].data, pos);
    pos += entries[i].data.length;
  }
  for (const h of centralHeaders) {
    result.set(h, pos);
    pos += h.length;
  }
  result.set(new Uint8Array(endBuf), pos);

  return result;
}

// ── Chat history → Markdown converter ─────────────────────────

function chatToMarkdown(messages: ChatMessage[], sessionTitle: string): string {
  const lines: string[] = [`# ${sessionTitle}`, ""];
  for (const msg of messages) {
    const prefix = msg.role === "user" ? "**You**" : "**AI**";
    lines.push(`### ${prefix}`, "");
    lines.push(msg.content || "_empty_");
    lines.push("");
  }
  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────

export interface ExportProjectPayload {
  project: Project;
  designMd: string | null;
  chatSessions: Array<{
    title: string;
    tab: "chat" | "code";
    messages: ChatMessage[];
  }>;
}

export function exportProjectAsZip(payload: ExportProjectPayload): void {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  const slug = payload.project.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "project";

  // 1. Design.md
  if (payload.designMd) {
    entries.push({
      name: `${slug}/Design.md`,
      data: encoder.encode(payload.designMd),
    });
  }

  // 2. Project metadata (JSON)
  const meta = {
    id: payload.project.id,
    name: payload.project.name,
    category: payload.project.category ?? "Unknown",
    template: payload.project.template ?? "None",
    target: payload.project.target ?? "React + Vite",
    createdAt: payload.project.createdAt,
    updatedAt: payload.project.updatedAt,
    exportedAt: new Date().toISOString(),
    sessionCount: payload.chatSessions.length,
  };
  entries.push({
    name: `${slug}/project.json`,
    data: encoder.encode(JSON.stringify(meta, null, 2)),
  });

  // 3. Design tokens (if any)
  if (payload.project.designTokens) {
    entries.push({
      name: `${slug}/tokens.json`,
      data: encoder.encode(payload.project.designTokens),
    });
  }

  // 4. Chat sessions → markdown files
  for (let i = 0; i < payload.chatSessions.length; i++) {
    const session = payload.chatSessions[i];
    if (session.messages.length === 0) continue;
    const filename = `${slug}/chat/${session.tab}-${i + 1}-${session.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}.md`;
    entries.push({
      name: filename,
      data: encoder.encode(chatToMarkdown(session.messages, session.title)),
    });
  }

  // 5. README.md
  const readme = [
    `# ${payload.project.name}`,
    "",
    `**Category**: ${meta.category}`,
    `**Template**: ${meta.template}`,
    `**Target**: ${meta.target}`,
    `**Exported**: ${meta.exportedAt}`,
    "",
    "## Contents",
    "",
    "| File | Description |",
    "|------|-------------|",
    payload.designMd ? "| `Design.md` | AI-generated design specification |" : "",
    "| `project.json` | Project metadata and settings |",
    payload.project.designTokens ? "| `tokens.json` | Design tokens (colors, spacing, typography) |" : "",
    ...payload.chatSessions.filter(s => s.messages.length > 0).map(
      (s, i) => `| \`chat/${s.tab}-${i + 1}-*.md\` | ${s.tab === "code" ? "Code assistant" : "Chat"} conversation |`,
    ),
    "",
    "## Usage",
    "",
    "Feed `Design.md` to your AI coding agent (Claude Code, Cursor, Codex, Windsurf):",
    "",
    "```bash",
    `cat ${slug}/Design.md | claude-code`,
    "```",
    "",
    "---",
    `*Exported from Desygn AI (https://design-md-ai-yd6r.vercel.app)*`,
  ].filter(Boolean).join("\n");

  entries.push({
    name: `${slug}/README.md`,
    data: encoder.encode(readme),
  });

  // Build ZIP and trigger download
  const zipData = buildZip(entries);
  const blob = new Blob([zipData], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-export.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
