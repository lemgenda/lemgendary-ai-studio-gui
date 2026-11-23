import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { HardwareProfile } from "../api/types";
import { servicePort } from "../api/config";

interface HardwareCardProps {
  hardware: HardwareProfile | null;
  onStartEnvManager?: () => void;
}

export const HardwareCard: React.FC<HardwareCardProps> = ({ hardware, onStartEnvManager }) => {
  if (!hardware) {
    return (
      <section className="card" aria-labelledby="hw-card-title-offline">
        <div className="card-title">
          <h3 id="hw-card-title-offline" className="card-heading">
            System &amp; Accelerator Profile
          </h3>
          <span className="badge badge-error" aria-label="Sidecar offline">OFFLINE</span>
        </div>
        <p className="offline-card-desc">
          Environment Manager (Port {servicePort("env-manager")}) is not reachable.
          Hardware metrics, Python runtime, and accelerator data are unavailable.
        </p>
        {onStartEnvManager && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartEnvManager}
            aria-label={`Launch the Environment Manager sidecar on Port ${servicePort("env-manager")}`}
          >
            Start Environment Manager
          </button>
        )}
      </section>
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
        <div className="row-gap-sm">
          <h3 id="hw-card-title" className="card-heading">System &amp; Hardware Architecture</h3>
          <HelpTooltip content="Deep platform probe executed by env_manager.system_probe. Queries OS kernel, CPU topology, system RAM, and GPU accelerator features." />
        </div>
        <div className="row-gap-sm">
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
        <span className="metric-value metric-value-mono">
          {hardware.recommended_torch_index}
        </span>
      </div>

      {hardware.accelerators.length > 0 && (
        <div className="hardware-accel-section">
          <div className="hardware-accel-header">
            <span className="hardware-accel-title">
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
