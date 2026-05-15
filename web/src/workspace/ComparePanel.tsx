/**
 * ComparePanel — Sprint 4: Design vs Web visual comparison.
 * Side-by-side or overlay view comparing Figma design frame with live web screenshot.
 * Supports fullscreen mode with bug markers.
 */
import { useCallback, useRef, useState } from "react";

export interface BugMarker {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  label: string;
  severity: "critical" | "major" | "minor";
}

interface ComparePanelProps {
  designImageUrl: string | null;
  webImageUrl: string | null;
  onCaptureFigma?: () => void;
  onCaptureWeb?: () => void;
  markers: BugMarker[];
  onAddMarker: (marker: BugMarker) => void;
  onRemoveMarker: (id: string) => void;
}

type CompareMode = "side-by-side" | "overlay" | "diff";

export function ComparePanel({
  designImageUrl,
  webImageUrl,
  onCaptureFigma,
  onCaptureWeb,
  markers,
  onAddMarker,
  onRemoveMarker,
}: ComparePanelProps) {
  const [mode, setMode] = useState<CompareMode>("side-by-side");
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [addingMarker, setAddingMarker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!addingMarker) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const id = `bug-${Date.now()}`;
      const label = prompt("Bug description:") ?? "";
      if (!label) { setAddingMarker(false); return; }
      onAddMarker({ id, x, y, label, severity: "major" });
      setAddingMarker(false);
    },
    [addingMarker, onAddMarker],
  );

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setIsFullscreen((prev) => !prev);
  }, [isFullscreen]);

  const severityColor = (s: BugMarker["severity"]) =>
    s === "critical" ? "#ef4444" : s === "major" ? "#f59e0b" : "#6c63ff";

  return (
    <div ref={containerRef} className={`compare-panel${isFullscreen ? " compare-fullscreen" : ""}`}>
      {/* Toolbar */}
      <div className="compare-toolbar">
        <div className="compare-mode-tabs">
          {(["side-by-side", "overlay", "diff"] as CompareMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "side-by-side" ? "Song song" : m === "overlay" ? "Chồng lớp" : "Khác biệt"}
            </button>
          ))}
        </div>
        <div className="compare-actions">
          <button
            type="button"
            className={`btn-marker${addingMarker ? " active" : ""}`}
            onClick={() => setAddingMarker(!addingMarker)}
            title="Đánh dấu lỗi"
          >
            🐛 {addingMarker ? "Đang đánh dấu…" : "Đánh dấu lỗi"}
          </button>
          <button type="button" onClick={toggleFullscreen} title="Toàn màn hình">
            {isFullscreen ? "⊘" : "⛶"} Fullscreen
          </button>
          {markers.length > 0 && (
            <span className="marker-count">{markers.length} lỗi</span>
          )}
        </div>
      </div>

      {/* Overlay opacity slider */}
      {mode === "overlay" && (
        <div className="compare-opacity-slider">
          <span>Design</span>
          <input
            type="range"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
          />
          <span>Web</span>
        </div>
      )}

      {/* Compare viewport */}
      <div className={`compare-viewport compare-${mode}`}>
        {mode === "side-by-side" && (
          <>
            <div className="compare-pane" onClick={addingMarker ? handleImageClick : undefined} style={{ cursor: addingMarker ? "crosshair" : "default" }}>
              <div className="compare-pane-label">🎨 Design (Figma)</div>
              {designImageUrl ? (
                <img src={designImageUrl} alt="Design" draggable={false} />
              ) : (
                <div className="compare-placeholder">
                  <div style={{ fontSize: 32 }}>🎨</div>
                  <div>Chưa có ảnh Design</div>
                  {onCaptureFigma && <button type="button" className="btn-outline" onClick={onCaptureFigma}>Chụp từ Figma</button>}
                </div>
              )}
              {renderMarkers(markers, severityColor, onRemoveMarker)}
            </div>
            <div className="compare-divider" />
            <div className="compare-pane">
              <div className="compare-pane-label">🌐 Web thực tế</div>
              {webImageUrl ? (
                <img src={webImageUrl} alt="Web" draggable={false} />
              ) : (
                <div className="compare-placeholder">
                  <div style={{ fontSize: 32 }}>🌐</div>
                  <div>Chưa có ảnh Web</div>
                  {onCaptureWeb && <button type="button" className="btn-outline" onClick={onCaptureWeb}>Chụp Playwright</button>}
                </div>
              )}
            </div>
          </>
        )}

        {mode === "overlay" && (
          <div className="compare-overlay-container" onClick={addingMarker ? handleImageClick : undefined} style={{ cursor: addingMarker ? "crosshair" : "default" }}>
            {designImageUrl && (
              <img src={designImageUrl} alt="Design" className="compare-overlay-base" draggable={false} />
            )}
            {webImageUrl && (
              <img src={webImageUrl} alt="Web" className="compare-overlay-top" style={{ opacity: overlayOpacity / 100 }} draggable={false} />
            )}
            {!designImageUrl && !webImageUrl && (
              <div className="compare-placeholder"><div style={{ fontSize: 32 }}>📐</div><div>Upload cả 2 ảnh để so sánh</div></div>
            )}
            {renderMarkers(markers, severityColor, onRemoveMarker)}
          </div>
        )}

        {mode === "diff" && (
          <div className="compare-diff-container">
            <div className="compare-placeholder">
              <div style={{ fontSize: 32 }}>🔍</div>
              <div>Pixel diff — sắp ra mắt</div>
              <div style={{ fontSize: 11, color: "#5c6378" }}>So sánh pixel-level giữa Design và Web</div>
            </div>
          </div>
        )}
      </div>

      {/* Bug marker list */}
      {markers.length > 0 && (
        <div className="compare-marker-list">
          <h4>Bug markers ({markers.length})</h4>
          {markers.map((m) => (
            <div key={m.id} className="compare-marker-item">
              <span className="marker-severity" style={{ background: severityColor(m.severity) }} />
              <span className="marker-label">{m.label}</span>
              <span className="marker-pos">({Math.round(m.x)}%, {Math.round(m.y)}%)</span>
              <button type="button" className="btn-trash" onClick={() => onRemoveMarker(m.id)}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderMarkers(
  markers: BugMarker[],
  severityColor: (s: BugMarker["severity"]) => string,
  onRemove: (id: string) => void,
) {
  return markers.map((m) => (
    <div
      key={m.id}
      className="bug-marker-pin"
      style={{ left: `${m.x}%`, top: `${m.y}%`, borderColor: severityColor(m.severity) }}
      title={`${m.severity}: ${m.label}`}
      onClick={(e) => { e.stopPropagation(); onRemove(m.id); }}
    >
      🐛
    </div>
  ));
}
