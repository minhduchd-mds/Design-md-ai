import type { ScanIssue } from "../../shared/types";
import { LocateIcon } from "./LocateIcon";

interface IssueListProps {
  issues: ScanIssue[];
}

function severityIcon(severity: "critical" | "warning" | "info"): string {
  switch (severity) {
    case "critical":
      return "!!";
    case "warning":
      return "!";
    case "info":
      return "i";
  }
}

function selectInFigma(nodeId: string) {
  parent.postMessage({ pluginMessage: { type: "select-node", nodeId } }, "*");
}

function CrosshairButton({ nodeId }: { nodeId: string }) {
  return (
    <button
      className="btn-crosshair"
      onClick={(e) => {
        e.stopPropagation();
        selectInFigma(nodeId);
      }}
      title="Select in Figma"
    >
      <LocateIcon size={14} />
    </button>
  );
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="issue-list-empty">No issues found. Your design is well-prepared for AI code generation.</div>
    );
  }

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div className="issue-list">
      <div className="issue-list-header">
        <span className="issue-count">{issues.length} issues</span>
        {critical.length > 0 && <span className="issue-badge severity-critical">{critical.length} critical</span>}
        {warnings.length > 0 && <span className="issue-badge severity-warning">{warnings.length} warnings</span>}
      </div>
      {issues.map((issue) => (
        <div key={issue.id} className={`issue-item severity-${issue.severity}`}>
          <div className="issue-header">
            <span className={`issue-icon severity-${issue.severity}`}>{severityIcon(issue.severity)}</span>
            <span className="issue-message">{issue.message}</span>
            {issue.nodeId && <CrosshairButton nodeId={issue.nodeId} />}
          </div>
          <div className="issue-path">{issue.path}</div>
          {issue.suggestion && <div className="issue-suggestion">{issue.suggestion}</div>}
        </div>
      ))}
    </div>
  );
}
