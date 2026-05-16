/**
 * PanelErrorBoundary — scoped error boundary for Chat / Workspace panels.
 *
 * Unlike the root ErrorBoundary in main.tsx, this catches errors at the
 * panel level so one panel crashing doesn't take down the whole app.
 *
 * Features:
 *  • Shows a friendly in-panel recovery UI (not a blank screen)
 *  • Emits to errorBus so the global error handler can log/report
 *  • "Try again" resets state and retries rendering
 *  • Copy error details for bug reports
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { errorBus } from "../lib/errorBus";

interface Props {
  panelName: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info });
    errorBus.emit({
      code: "PANEL_CRASH",
      message: `${this.props.panelName} crashed: ${error.message}`,
      severity: "error",
      retryable: true,
      context: {
        panelName: this.props.panelName,
        stack: error.stack,
        componentStack: info.componentStack ?? "",
      },
    });
  }

  private reset = () => this.setState({ error: null, errorInfo: null, copied: false });

  private copyError = async () => {
    const text = [
      `Panel: ${this.props.panelName}`,
      `Error: ${this.state.error?.message ?? "unknown"}`,
      `Stack: ${this.state.error?.stack ?? ""}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch { /* ignore */ }
  };

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", padding: "2rem", gap: "1rem", color: "#e2e8f0", textAlign: "center",
      }}>
        <div style={{ fontSize: "2rem" }}>⚠️</div>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          {this.props.panelName} gặp sự cố
        </h3>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8", maxWidth: 320 }}>
          {this.state.error.message}
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: "0.4rem 1rem", borderRadius: "0.4rem", border: "none",
              background: "#6d28d9", color: "#fff", cursor: "pointer", fontSize: "0.8rem",
            }}
          >
            Thử lại
          </button>
          <button
            type="button"
            onClick={this.copyError}
            style={{
              padding: "0.4rem 1rem", borderRadius: "0.4rem",
              border: "1px solid #334155", background: "transparent",
              color: "#94a3b8", cursor: "pointer", fontSize: "0.8rem",
            }}
          >
            {this.state.copied ? "✓ Đã copy" : "Copy lỗi"}
          </button>
        </div>
      </div>
    );
  }
}
