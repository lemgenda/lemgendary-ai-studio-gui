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
    <div className="card">
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Real-time Telemetry & Pipeline Stream</span>
          <span className={`badge ${isConnected ? "badge-success" : "badge-error"}`}>
            {isConnected ? "WS CONNECTED" : "OFFLINE"}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "11px", padding: "4px 10px" }}
          onClick={onClear}
        >
          Clear Stream
        </button>
      </div>

      <div ref={containerRef} className="log-container">
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
    </div>
  );
};
