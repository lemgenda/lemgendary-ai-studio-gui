import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { MeshStatus } from "../api/types";
import { ENV_BASE, DATASETS_BASE, TRAINING_BASE } from "../api/client";

interface ServiceTilesProps {
  meshStatus: MeshStatus;
  onNavigate: (tab: string) => void;
  onRunAudit: () => void;
  onStartService: (serviceId: string) => Promise<void> | void;
  startingServiceId?: string | null;
}

interface ServiceCardProps {
  id: string;
  name: string;
  port: number;
  url: string;
  description: string;
  online: boolean;
  quickActionLabel: string;
  quickActionAriaLabel: string;
  onQuickAction: () => void;
  onStartService: (id: string) => void;
  isStarting?: boolean;
  helpContent: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  id,
  name,
  port,
  url,
  description,
  online,
  quickActionLabel,
  quickActionAriaLabel,
  onQuickAction,
  onStartService,
  isStarting,
  helpContent,
}) => {
  const headingId = `service-card-title-${id}`;

  return (
    <article
      className="card"
      aria-labelledby={headingId}
      style={{
        borderColor: online ? "var(--border-color)" : "rgba(244, 63, 94, 0.3)",
      }}
    >
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <h3 id={headingId} style={{ fontSize: "14px", fontWeight: 600 }}>
            {name}
          </h3>
          <HelpTooltip content={helpContent} />
        </div>
        <span
          className={`badge ${online ? "badge-success" : "badge-error"}`}
          aria-label={`Service status: ${online ? "Online" : "Offline"}`}
        >
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Port</span>
        <span className="metric-value">{port}</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">URL</span>
        <span
          className="metric-value"
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}
        >
          {url}
        </span>
      </div>

      <p
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          marginTop: "10px",
          marginBottom: "14px",
          lineHeight: "1.5",
        }}
      >
        {description}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%", fontSize: "12px" }}
          disabled={!online}
          aria-disabled={!online}
          aria-label={online ? quickActionAriaLabel : `${quickActionAriaLabel} (sidecar offline)`}
          onClick={onQuickAction}
        >
          {quickActionLabel}
        </button>

        {!online && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", fontSize: "12px" }}
            aria-label={`Start ${name} background daemon`}
            disabled={isStarting}
            onClick={() => onStartService(id)}
          >
            {isStarting ? "Starting Service..." : "Start Service"}
          </button>
        )}
      </div>
    </article>
  );
};

export const ServiceTiles: React.FC<ServiceTilesProps> = ({
  meshStatus,
  onNavigate,
  onRunAudit,
  onStartService,
  startingServiceId,
}) => {
  const services: Omit<ServiceCardProps, "onStartService" | "isStarting">[] = [
    {
      id: "env-manager",
      name: "LemGendary Environment Manager",
      port: 8000,
      url: ENV_BASE,
      description:
        "Orchestrates virtual environments, system hardware audits, toolchain validation, and the 7-step clean install pipeline across all workspace projects.",
      online: meshStatus.envManager,
      quickActionLabel: "Run Full System Audit",
      quickActionAriaLabel: "Trigger a full system audit via the Environment Manager pipeline",
      onQuickAction: onRunAudit,
      helpContent:
        "Port 8000 sidecar. Powers hardware profiling, project health audits, version drift matrices, and the deterministic clean install pipeline.",
    },
    {
      id: "dataset-compiler",
      name: "LemGendary Dataset Compiler Suite",
      port: 8100,
      url: DATASETS_BASE,
      description:
        "Manages the manifold catalog, streaming WebDataset and MDS shard compilation, multi-source ingestion from Kaggle, HuggingFace, Google Drive, and GitHub.",
      online: meshStatus.datasetCompiler,
      quickActionLabel: "Open Dataset Compiler",
      quickActionAriaLabel: "Navigate to the Dataset Compiler panel",
      onQuickAction: () => onNavigate("datasets"),
      helpContent:
        "Port 8100 sidecar. Provides manifold format inspection, streaming compilation, and automated WebP transcoding for all 20 production manifolds.",
    },
    {
      id: "training-suite",
      name: "LemGendary Model Training Suite",
      port: 8200,
      url: TRAINING_BASE,
      description:
        "Hosts the neural architecture registry, dynamic spatial ladder training dispatch, Sawtooth Governor VRAM telemetry, and ONNX export packaging.",
      online: meshStatus.trainingSuite,
      quickActionLabel: "Open Training Suite",
      quickActionAriaLabel: "Navigate to the Master Training Suite panel",
      onQuickAction: () => onNavigate("training"),
      helpContent:
        "Port 8200 sidecar. Controls model training runs, architecture selection, hyperparameter configuration, and safetensors checkpoint export.",
    },
  ];

  return (
    <section aria-labelledby="service-tiles-heading" style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <h3 id="service-tiles-heading" style={{ fontSize: "16px", fontWeight: 600 }}>
          Ecosystem Sidecar Services
        </h3>
        <HelpTooltip content="Live status of all three local microservices. Each sidecar must be running to enable its respective GUI panel. Click 'Start Service' on any card to launch its background daemon." />
      </div>

      <div className="card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {services.map((svc) => (
          <ServiceCard
            key={svc.id}
            {...svc}
            onStartService={onStartService}
            isStarting={startingServiceId === svc.id || startingServiceId === "all"}
          />
        ))}
      </div>
    </section>
  );
};

export default ServiceTiles;
