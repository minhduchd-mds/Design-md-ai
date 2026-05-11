import { useMemo, useState } from "react";
import { marked } from "marked";
import JSZip from "jszip";
import type { Screen } from "../design/screenGenerator";
import { parseScreensFromMarkdown } from "../design/screenGenerator";
import styles from "./SplitView.module.css";

interface SplitViewProps {
  initialMarkdown: string;
  screens: Screen[];
  projectId: string;
  onExport: (markdown: string) => void;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function combineScreens(screens: Screen[]): string {
  return screens.map((screen) => screen.markdown).join("\n\n---\n\n");
}

function extractHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^##+\s+(.+)$/gm)].map((match) => match[1]);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SplitView({ initialMarkdown, screens, projectId, onExport }: SplitViewProps) {
  const initialScreens = useMemo(() => (screens.length > 0 ? screens : parseScreensFromMarkdown(initialMarkdown)), [initialMarkdown, screens]);
  const [editableScreens, setEditableScreens] = useState<Screen[]>(initialScreens);
  const [activeScreen, setActiveScreen] = useState(0);
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [lastSaved, setLastSaved] = useState<string>("Not saved yet");
  const current = editableScreens[activeScreen] ?? editableScreens[0];
  const activeMarkdown = current?.markdown ?? initialMarkdown;
  const headings = extractHeadings(activeMarkdown);
  const previewHtml = marked.parse(activeMarkdown, { async: false }) as string;

  const updateScreenMarkdown = (markdown: string) => {
    setEditableScreens((items) =>
      items.map((item, index) =>
        index === activeScreen
          ? {
              ...item,
              markdown,
            }
          : item,
      ),
    );

    window.setTimeout(() => {
      const key = `design-md-${projectId}-${current?.name ?? activeScreen}`;
      localStorage.setItem(key, markdown);
      setLastSaved(new Date().toLocaleTimeString());
    }, 300);
  };

  const copyActive = async () => {
    await navigator.clipboard.writeText(activeMarkdown);
  };

  const exportZip = async () => {
    const zip = new JSZip();
    editableScreens.forEach((screen) => {
      zip.file(`screens/${slugify(screen.name) || "screen"}.md`, screen.markdown);
    });
    zip.file("DESIGN.md", combineScreens(editableScreens));
    zip.file("BA_TEMPLATE.md", "# BA Handoff Guide\n\nRead DESIGN.md first, then review each screen file in order.\n");
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${projectId || "design-md"}-handoff.zip`);
  };

  return (
    <section className={styles.container}>
      <header className={styles.toolbar}>
        <strong>Design.md Split View</strong>
        <div className={styles.toolbarActions}>
          <button className={styles.button} type="button" onClick={copyActive}>
            Copy
          </button>
          <button className={styles.button} type="button" onClick={() => onExport(combineScreens(editableScreens))}>
            Export DESIGN.md
          </button>
          <button className={styles.button} type="button" onClick={exportZip}>
            Export ZIP
          </button>
        </div>
      </header>

      <nav className={styles.screenTabs} aria-label="Screen tabs">
        {editableScreens.map((screen, index) => (
          <button
            key={screen.name}
            type="button"
            className={`${styles.tab} ${index === activeScreen ? styles.tabActive : ""}`}
            onClick={() => setActiveScreen(index)}
          >
            {screen.name}
          </button>
        ))}
      </nav>

      <div className={styles.panels}>
        <div className={styles.editPanel}>
          <textarea className={styles.textarea} value={activeMarkdown} onChange={(event) => updateScreenMarkdown(event.target.value)} />
          <div className={styles.saved}>Last saved: {lastSaved}</div>
        </div>
        <div className={`${styles.previewPanel} ${previewTheme === "light" ? styles.light : ""}`}>
          <div className={styles.previewHeader}>
            <strong>Preview</strong>
            <button className={styles.button} type="button" onClick={() => setPreviewTheme((theme) => (theme === "dark" ? "light" : "dark"))}>
              {previewTheme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
          <div className={styles.previewShell}>
            <aside className={styles.sidebar}>
              {headings.map((heading) => (
                <button key={heading} type="button" onClick={() => document.getElementById(slugify(heading))?.scrollIntoView({ behavior: "smooth" })}>
                  {heading}
                </button>
              ))}
            </aside>
            <article className={styles.previewContent} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    </section>
  );
}
