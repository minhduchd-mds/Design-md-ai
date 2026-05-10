export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect
            x="8"
            y="8"
            width="32"
            height="32"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 3"
            opacity="0.4"
          />
          <path d="M20 24h8M24 20v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </svg>
      </div>
      <div className="empty-title">Select a frame</div>
      <div className="empty-hint">
        Score your Figma designs for AI-readiness, fix common issues, and generate structured code prompts. Each prompt trains a reusable skill for your design system.
      </div>
    </div>
  );
}
