import React, { useEffect, useRef, useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { PipelineEvent } from "../api/types";

interface LogPanelProps {
  events: PipelineEvent[];
  onClear: () => void;
  isConnected: boolean;
}

export const LogPanel: React.FC<LogPanelProps> = ({ events, onClear, isConnected }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  const handleCopy = async () => {
    if (events.length === 0) return;

    const formattedLog = events
      .map((ev) => {
        const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "--:--:--";
        const stepTag = ev.step_number > 0 ? `Step ${ev.step_number}` : "SYS";
        return `[${timeStr}] [${stepTag}] [${ev.step_name.toUpperCase()}]: ${ev.message}`;
      })
      .join("\n");

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedLog);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = formattedLog;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy telemetry logs to clipboard:", err);
    }
  };

  return (
    <section className="card" aria-labelledby="telemetry-stream-heading">
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 id="telemetry-stream-heading" style={{ fontSize: "16px", fontWeight: 600 }}>Real-time Telemetry &amp; Pipeline Stream</h3>
          <HelpTooltip content="Monospace live telemetry terminal. Receives real-time logs and progress updates over local WebSocket (ws://127.0.0.1:8000/ws/log)." />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className={`badge ${isConnected ? "badge-success" : "badge-error"}`}
              aria-label={`WebSocket status: ${isConnected ? "Connected" : "Offline"}`}
            >
              {isConnected ? "WS CONNECTED" : "OFFLINE"}
            </span>
            <HelpTooltip content={isConnected ? "WebSocket connection established with sidecar daemon." : "WebSocket connection lost. Retrying automatically every 3 seconds."} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "11px", padding: "4px 10px" }}
            onClick={handleCopy}
            disabled={events.length === 0}
            aria-label={copied ? "Telemetry logs copied to clipboard" : "Copy telemetry stream logs to clipboard"}
          >
            {copied ? "Copied" : "Copy Stream"}
          </button>
          <HelpTooltip content="Copy full telemetry log buffer to clipboard as plain text for debugging and issue diagnosis." />

          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "11px", padding: "4px 10px" }}
            onClick={onClear}
            aria-label="Clear telemetry stream log"
          >
            Clear Stream
          </button>
          <HelpTooltip content="Flush local terminal event buffer. Clears displayed messages to isolate diagnostics for new operations." />
        </div>
      </div>

      <div
        ref={containerRef}
        className="log-container"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions text"
        aria-label="Real-time telemetry and pipeline stream log"
        style={{ userSelect: "text", WebkitUserSelect: "text" }}
      >
        {events.length === 0 ? (
          <div style={{ color: "var(--text-muted)", padding: "12px 0", userSelect: "none" }}>
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
              <div key={index} className="log-line" style={{ userSelect: "text" }}>
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

export default LogPanel;
