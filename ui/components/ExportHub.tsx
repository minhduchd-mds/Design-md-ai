import { useState } from "react";
import styles from "./ExportHub.module.css";

interface ExportHubProps {
  onDownloadProject: () => void;
  onExportFigmaFrame: () => void;
  onCopyPrompt: () => void;
  onExportBAReport: () => void;
  isExporting: boolean;
  isCopied: boolean;
  frameStatus: string | null;
  tokenEstimate: number;
  fileCount: number;
}

export function ExportHub({
  onDownloadProject, onExportFigmaFrame, onCopyPrompt, onExportBAReport,
  isExporting, isCopied, frameStatus, tokenEstimate, fileCount,
}: ExportHubProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={styles.root}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Export</span>
          <span className={styles.badge}>{fileCount} files · ~{formatTokens(tokenEstimate)} tokens</span>
        </div>
        <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.grid}>
            <button className={styles.exportCard} onClick={onDownloadProject}>
              <span className={styles.exportIcon}>📦</span>
              <span className={styles.exportLabel}>Download Project</span>
              <span className={styles.exportDesc}>ZIP with all markdown files</span>
            </button>

            <button className={styles.exportCard} onClick={onExportFigmaFrame} disabled={isExporting}>
              <span className={styles.exportIcon}>🎨</span>
              <span className={styles.exportLabel}>{isExporting ? "Exporting..." : "Export Figma Frame"}</span>
              <span className={styles.exportDesc}>Create visual frame in Figma</span>
            </button>

            <button className={styles.exportCard} onClick={onCopyPrompt}>
              <span className={styles.exportIcon}>📋</span>
              <span className={styles.exportLabel}>{isCopied ? "Copied!" : "Copy AI Prompt"}</span>
              <span className={styles.exportDesc}>Full prompt for Claude/Cursor</span>
            </button>

            <button className={styles.exportCard} onClick={onExportBAReport}>
              <span className={styles.exportIcon}>📄</span>
              <span className={styles.exportLabel}>Export BA Report</span>
              <span className={styles.exportDesc}>Standards + evaluation as markdown</span>
            </button>
          </div>

          {frameStatus && <div className={styles.status}>{frameStatus}</div>}
        </div>
      )}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
