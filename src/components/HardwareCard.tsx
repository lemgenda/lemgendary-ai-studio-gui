import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { HardwareProfile } from "../api/types";

interface HardwareCardProps {
  hardware: HardwareProfile | null;
}

export const HardwareCard: React.FC<HardwareCardProps> = ({ hardware }) => {
  if (!hardware) {
    return (
      <div className="card">
        <h3 className="card-title">System &amp; Accelerator Profile</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading hardware profile...</p>
      </div>
    );
  }

  const backendBadgeClass =
    hardware.primary_backend === "cuda"
      ? "badge-success"
      : hardware.primary_backend === "rocm"
      ? "badge-info"
      : hardware.primary_backend === "directml"
      ? "badge-info"
      : "badge-warning";

  return (
    <section className="card" aria-labelledby="hw-card-title">
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <h3 id="hw-card-title" style={{ fontSize: "16px", fontWeight: 600 }}>System &amp; Hardware Architecture</h3>
          <HelpTooltip content="Deep platform probe executed by env_manager.system_probe. Queries OS kernel, CPU topology, system RAM, and GPU accelerator features." />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className={`badge ${backendBadgeClass}`}
            aria-label={`Primary accelerator backend: ${hardware.primary_backend.toUpperCase()}`}
          >
            {hardware.primary_backend.toUpperCase()}
          </span>
          <HelpTooltip content={`Primary deep learning acceleration backend detected: ${hardware.primary_backend.toUpperCase()}.`} />
        </div>
      </div>

      <div className="metric-row">
        <span className="metric-label">Operating System</span>
        <span className="metric-value">
          {hardware.os_name} ({hardware.os_release}, {hardware.architecture})
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Python Runtime</span>
        <span className="metric-value">{hardware.python_version}</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">CPU Cores (Logical / Physical)</span>
        <span className="metric-value">
          {hardware.cpu_count_logical} / {hardware.cpu_count_physical}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">System RAM</span>
        <span className="metric-value">{hardware.total_ram_mb.toLocaleString()} MB</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Recommended Torch Index</span>
        <span className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          {hardware.recommended_torch_index}
        </span>
      </div>

      {hardware.accelerators.length > 0 && (
        <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
              Detected Accelerators:
            </span>
            <HelpTooltip content="Physical GPU devices detected via NVIDIA Management Library (NVML) or DirectML platform enumeration." />
          </div>
          {hardware.accelerators.map((acc, idx) => (
            <div key={idx} className="metric-row">
              <span className="metric-label">{acc.name}</span>
              <span className="metric-value">
                {acc.total_memory_mb > 0 ? `${acc.total_memory_mb} MB VRAM` : "VRAM Managed"}
                {acc.driver_version ? ` | Driver: ${acc.driver_version}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default HardwareCard;
