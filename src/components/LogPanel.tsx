import React, { useEffect, useRef } from "react";
import { PipelineEvent } from "../api/types";

interface LogPanelProps {
  events: PipelineEvent[];
  onClear: () => void;
  isConnected: boolean;
}

export const LogPanel: React.FC<LogPanelProps> = ({ events, onClear, isConnected }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <section className="card" aria-labelledby="telemetry-stream-heading">
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 id="telemetry-stream-heading" style={{ fontSize: "16px", fontWeight: 600 }}>Real-time Telemetry & Pipeline Stream</h3>
          <span
            className={`badge ${isConnected ? "badge-success" : "badge-error"}`}
            aria-label={`WebSocket status: ${isConnected ? "Connected" : "Offline"}`}
          >
            {isConnected ? "WS CONNECTED" : "OFFLINE"}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "11px", padding: "4px 10px" }}
          onClick={onClear}
          aria-label="Clear telemetry stream log"
        >
          Clear Stream
        </button>
      </div>

      <div
        ref={containerRef}
        className="log-container"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions text"
        aria-label="Real-time telemetry and pipeline stream log"
      >
        {events.length === 0 ? (
          <div style={{ color: "var(--text-muted)", padding: "12px 0" }}>
            [Awaiting telemetry stream from sidecar server...]
          </div>
        ) : (
          events.map((ev, index) => {
            const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "--:--:--";
            const tagClass =
              ev.status === "success"
                ? "log-tag-success"
                : ev.status === "error"
                ? "log-tag-error"
                : ev.status === "warning"
                ? "log-tag-warning"
                : "log-tag-info";

            return (
              <div key={index} className="log-line">
                <span className="log-time">[{timeStr}]</span>
                <span className={tagClass}>
                  [{ev.step_number > 0 ? `Step ${ev.step_number}` : "SYS"}] [{ev.step_name.toUpperCase()}]:
                </span>
                <span>{ev.message}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
