import React, { useMemo, useRef } from "react";
import { HelpTooltip } from "../HelpTooltip";
import { PipelineEvent } from "../../api/types";
import { TelemetryProgressTracker } from "../common/TelemetryProgressTracker";
import { parseProgressMessage } from "../../utils/progressParser";
import { isProgressLine, rollupTelemetryEvents } from "../../api/client";

export interface TelemetryConsoleProps {
  activeTelemetryTab: "local" | "remote" | "mesh";
  onTabChange: (tab: "local" | "remote" | "mesh") => void;
  localJobId: string | null;
  localJobModel: string | null;
  remoteJobId: string | null;
  remoteJobModel: string | null;
  displayedLocalEvents: PipelineEvent[];
  displayedRemoteEvents: PipelineEvent[];
  onCopyLocalStream: () => void;
  localCopied: boolean;
  onClearLocalStream: () => void;
  onStopLocalTrain: () => void;
  isStoppingLocal: boolean;
  onCopyRemoteStream: () => void;
  remoteCopied: boolean;
  onClearRemoteStream: () => void;
  logSlot?: React.ReactNode;
}

export const TelemetryConsole: React.FC<TelemetryConsoleProps> = ({
  activeTelemetryTab,
  onTabChange,
  localJobId,
  localJobModel,
  remoteJobId,
  remoteJobModel,
  displayedLocalEvents,
  displayedRemoteEvents,
  onCopyLocalStream,
  localCopied,
  onClearLocalStream,
  onStopLocalTrain,
  isStoppingLocal,
  onCopyRemoteStream,
  remoteCopied,
  onClearRemoteStream,
  logSlot,
}) => {
  const localLogContainerRef = useRef<HTMLDivElement>(null);
  const remoteLogContainerRef = useRef<HTMLDivElement>(null);

  const activeLocalProgress = useMemo(() => {
    if (displayedLocalEvents.length === 0) return null;
    for (let i = displayedLocalEvents.length - 1; i >= Math.max(0, displayedLocalEvents.length - 4); i--) {
      const ev = displayedLocalEvents[i];
      if (ev.is_progress || isProgressLine(ev.message)) {
        const parsed = parseProgressMessage(ev.message, ev.step_name);
        if (parsed) {
          return parsed;
        }
      }
    }
    return null;
  }, [displayedLocalEvents]);

  const activeRemoteProgress = useMemo(() => {
    if (displayedRemoteEvents.length === 0) return null;
    for (let i = displayedRemoteEvents.length - 1; i >= Math.max(0, displayedRemoteEvents.length - 4); i--) {
      const ev = displayedRemoteEvents[i];
      if (ev.is_progress || isProgressLine(ev.message)) {
        const parsed = parseProgressMessage(ev.message, ev.step_name);
        if (parsed) {
          return parsed;
        }
      }
    }
    return null;
  }, [displayedRemoteEvents]);

  // Roll up rapid progress ticks in-place while preserving all discrete logs and training metrics
  const cleanLocalEvents = useMemo(() => {
    return rollupTelemetryEvents(displayedLocalEvents);
  }, [displayedLocalEvents]);

  const cleanRemoteEvents = useMemo(() => {
    return rollupTelemetryEvents(displayedRemoteEvents);
  }, [displayedRemoteEvents]);

  return (
    <div id="telemetry-panel-anchor" style={{ marginTop: "28px" }}>
      <section className="card" aria-labelledby="telemetry-card-heading">
        {/* Telemetry Card Header with Process Tabs */}
        <div
          className="card-title"
          style={{
            flexWrap: "wrap",
            gap: "12px",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h3 id="telemetry-card-heading" style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Real-Time Telemetry &amp; Execution
            </h3>
            <HelpTooltip content="Unified telemetry hub supporting concurrent local GPU training and remote Kaggle/Colab cloud training in isolated streams." />

            {/* Tab Switcher */}
            <div
              style={{
                display: "inline-flex",
                background: "rgba(0,0,0,0.3)",
                padding: "3px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                gap: "4px",
              }}
            >
              {/* Tab 1: Local Training */}
              <button
                type="button"
                className={`btn ${activeTelemetryTab === "local" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => onTabChange("local")}
                style={{ fontSize: "11px", padding: "4px 10px", gap: "6px" }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: localJobId ? "var(--accent-emerald, #10b981)" : "#64748b",
                    animation: localJobId ? "pulse 1.5s infinite" : "none",
                  }}
                />
                <span>Local Training {localJobId ? `(${localJobModel || "Active"})` : ""}</span>
              </button>

              {/* Tab 2: Remote / Cloud Training */}
              <button
                type="button"
                className={`btn ${activeTelemetryTab === "remote" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => onTabChange("remote")}
                style={{ fontSize: "11px", padding: "4px 10px", gap: "6px" }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: remoteJobId ? "var(--accent-cyan, #06b6d4)" : "#64748b",
                    animation: remoteJobId ? "pulse 1.5s infinite" : "none",
                  }}
                />
                <span>
                  Remote Cloud{remoteJobModel ? ` (${remoteJobModel})` : ""}
                </span>
              </button>

              {/* Tab 3: Mesh Stream */}
              <button
                type="button"
                className={`btn ${activeTelemetryTab === "mesh" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => onTabChange("mesh")}
                style={{ fontSize: "11px", padding: "4px 10px" }}
              >
                Ecosystem Mesh
              </button>
            </div>
          </div>

          {/* Quick Context Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {activeTelemetryTab === "local" && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                  onClick={onCopyLocalStream}
                  disabled={displayedLocalEvents.length === 0}
                  aria-label={localCopied ? "Local logs copied to clipboard" : "Copy local training stream logs to clipboard"}
                >
                  {localCopied ? "Copied" : "Copy Stream"}
                </button>
                <HelpTooltip content="Copy local training telemetry log buffer to clipboard as plain text." />

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                  onClick={onClearLocalStream}
                  aria-label="Clear local training stream log"
                >
                  Clear Stream
                </button>
                <HelpTooltip content="Flush local terminal event buffer. Clears displayed messages to isolate diagnostics for new operations." />

                {localJobId && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={onStopLocalTrain}
                    disabled={isStoppingLocal}
                    style={{ fontSize: "11px", padding: "4px 12px" }}
                  >
                    {isStoppingLocal ? "Halting Job..." : "Halt Local Job"}
                  </button>
                )}
              </>
            )}

            {activeTelemetryTab === "remote" && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                  onClick={onCopyRemoteStream}
                  disabled={displayedRemoteEvents.length === 0}
                  aria-label={remoteCopied ? "Remote logs copied to clipboard" : "Copy remote cloud stream logs to clipboard"}
                >
                  {remoteCopied ? "Copied" : "Copy Stream"}
                </button>
                <HelpTooltip content="Copy remote cloud telemetry log buffer to clipboard as plain text." />

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                  onClick={onClearRemoteStream}
                  aria-label="Clear remote cloud stream log"
                >
                  Clear Stream
                </button>
                <HelpTooltip content="Flush remote cloud terminal event buffer. Clears displayed messages to isolate diagnostics for new operations." />

              </>
            )}
          </div>
        </div>

        {/* ─── TAB 1: LOCAL TRAINING TELEMETRY ────────────────────────────── */}
        {activeTelemetryTab === "local" && (
          <div>
            {/* Local Training Status Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.02)",
                padding: "10px 14px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                marginBottom: "12px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`badge ${localJobId ? "badge-success" : "badge-neutral"}`} style={{ fontWeight: 700 }}>
                  {localJobId ? "LOCAL TRAINING IN PROGRESS" : "LOCAL WORKER IDLE"}
                </span>
                {localJobId ? (
                  <span style={{ color: "var(--text-secondary)" }}>
                    Active Model: <strong style={{ color: "var(--text-primary)" }}>{localJobModel}</strong> | Job ID:{" "}
                    <code>{localJobId}</code>
                  </span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>
                    Select any model card above and click &quot;Local Training&quot; to begin governed local GPU execution.
                  </span>
                )}
              </div>
            </div>

            {/* Active Progress Tracker for Local Training */}
            <TelemetryProgressTracker progress={activeLocalProgress} />

            {/* Local Training Monospace Stream */}
            <div
              ref={localLogContainerRef}
              className="log-container"
              role="log"
              style={{ minHeight: "260px", maxHeight: "360px", overflowY: "auto" }}
            >
              {cleanLocalEvents.length === 0 ? (
                <div className="log-empty">
                  {localJobId
                    ? "Awaiting training stream packets from sidecar..."
                    : "No active local training stream. Launch a local model to monitor live execution."}
                </div>
              ) : (
                cleanLocalEvents.map((ev, idx) => (
                  <div key={`local-${ev.timestamp}-${idx}`} className="log-line">
                    <span className="log-timestamp">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "--:--:--"}
                    </span>
                    <span className="log-step">[LOCAL] [{ev.step_name.toUpperCase()}]:</span>
                    <span
                      className={`log-message ${
                        ev.message.includes("failed") || ev.message.includes("error") ? "log-error" : ""
                      }`}
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                    >
                      {ev.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: REMOTE / CLOUD TRAINING (KAGGLE & COLAB) ────────────── */}
        {activeTelemetryTab === "remote" && (
          <div>


            {/* Active Progress Tracker for Remote/Cloud Training */}
            <TelemetryProgressTracker progress={activeRemoteProgress} />

            {/* Remote Cloud Monospace Stream */}
            <div
              ref={remoteLogContainerRef}
              className="log-container"
              role="log"
              style={{ minHeight: "240px", maxHeight: "340px", overflowY: "auto" }}
            >
              {cleanRemoteEvents.length === 0 ? (
                <div className="log-empty">
                  No remote cloud telemetry received yet. Launch cloud training via the Cloud Training button on a model card to stream output here.
                </div>
              ) : (
                cleanRemoteEvents.map((ev, idx) => (
                  <div key={`remote-${ev.timestamp}-${idx}`} className="log-line">
                    <span className="log-timestamp">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "--:--:--"}
                    </span>
                    <span className="log-step">[CLOUD] [{ev.step_name.toUpperCase()}]:</span>
                    <span
                      className={`log-message ${
                        ev.message.includes("failed") || ev.message.includes("error") ? "log-error" : ""
                      }`}
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                    >
                      {ev.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: ECOSYSTEM PIPELINE STREAM ────────────────────────────── */}
        {activeTelemetryTab === "mesh" && <div>{logSlot}</div>}
      </section>
    </div>
  );
};
