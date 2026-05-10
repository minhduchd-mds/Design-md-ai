import { useState, useEffect, useRef } from "react";
import type { BatchScanResult } from "../../shared/types";
import { LevelIcon, LEVEL_CONFIG } from "./AtomicBadge";
import styles from "./BatchPanel.module.css";

interface BatchPanelProps {
  result: BatchScanResult;
  onSelectNode: (nodeId: string) => void;
}

function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, ",")}${String(n % 1000).padStart(3, "0").slice(0, 3)}` : String(n);
}

export function BatchPanel({ result, onSelectNode }: BatchPanelProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const copiedTimer = useRef<number>(0);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const handleCopy = async () => {
    if (!result.batchPromptCompact) return;
    try {
      await navigator.clipboard.writeText(result.batchPromptCompact);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = result.batchPromptCompact;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  const tokens = result.batchPromptCompact ? estimateTokens(result.batchPromptCompact) : 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>Batch Analysis</span>
      </div>

      <span className={styles.sectionLabel}>Build Order → Atoms first</span>

      <div className={styles.items}>
        {result.items.map((item, i) => {
          const levelConfig = LEVEL_CONFIG[item.atomicLevel];
          return (
            <button key={item.nodeId} className={styles.item} onClick={() => onSelectNode(item.nodeId)}>
              <span className={styles.itemStep}>{i + 1}</span>
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemLevel}>
                <LevelIcon level={item.atomicLevel} color={levelConfig?.color ?? "#999"} size={16} />
                <span style={{ color: levelConfig?.color }}>{levelConfig?.label ?? item.atomicLevel}</span>
              </span>
              <span className={`${styles.itemScore} ${item.score >= 75 ? styles.green : item.score >= 50 ? styles.yellow : styles.red}`}>
                {item.score}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.overallRow}>
        <span className={styles.overallLabel}>Overall Score</span>
        <span className={`${styles.overallScore} ${result.averageScore >= 75 ? styles.green : result.averageScore >= 50 ? styles.yellow : styles.red}`}>
          {result.averageScore}
        </span>
      </div>

      {result.batchPromptCompact && (
        <>
          <hr className={styles.divider} aria-hidden />

          <div className={styles.exportHeader}>
            <span className={styles.exportTitle}>AI Prompt Ready</span>
          </div>
          <p className={styles.exportDescription}>
            Copy this prompt into the LLM of your choice (Claude, Cursor, you name it) to generate production-ready code.
          </p>
          <p className={styles.exportDescription}>
            It contains your component's full structure, tokens, and layout. The prompt also trains your existing design2code-Skill or creates a new one.
          </p>
          <p className={styles.exportDescription}>
            Your LLM might ask you to create or overwrite the skill. It asks before doing possible breaking changes.
          </p>

          <span className={styles.tokenEstimate}>
            Est. Token-Usage: ca. {formatTokens(tokens)} tokens
          </span>

          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy Batch Prompt"}
          </button>

          <button className={`btn-link ${styles.toggleLink}`} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide preview" : "Show preview"}
          </button>

          {expanded && (
            <div className={styles.preview}>
              <pre>{result.batchPromptCompact}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
