import React from "react";
import { ModelItem } from "../../api/types";
import { LocalTrainSettings } from "./localTrainSettings";

const BUTTON_STYLE: React.CSSProperties = { fontSize: "11px", padding: "6px 8px", fontWeight: 600 };
const ICON_STYLE: React.CSSProperties = { flexShrink: 0 };

/** 12 px icon; `filled` icons use `currentColor` fill, the others a 2.5 px stroke. */
const CardIcon: React.FC<{ filled?: boolean; children: React.ReactNode }> = ({ filled = false, children }) =>
  filled ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={ICON_STYLE}>
      {children}
    </svg>
  ) : (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={ICON_STYLE}
    >
      {children}
    </svg>
  );

interface CardActionButtonProps {
  id?: string;
  className: string;
  onClick: () => void;
  disabled: boolean;
  title?: string;
  icon: React.ReactNode;
  label: string;
}

const CardActionButton: React.FC<CardActionButtonProps> = ({ id, className, onClick, disabled, title, icon, label }) => (
  <button id={id} type="button" className={className} onClick={onClick} disabled={disabled} style={BUTTON_STYLE} title={title}>
    {icon}
    <span>{label}</span>
  </button>
);

export interface ModelCardActionHandlers {
  onStartLocalTrain: (model: ModelItem, settings: LocalTrainSettings) => void;
  onStopLocalTrain: () => void;
  onOpenCloudModal: (model: ModelItem) => void;
  onPushArtifacts: (modelKey: string) => void;
  onPullArtifacts: (modelKey: string) => void;
  onGenerateTrainingNotebook: (modelKey: string) => void;
  onGenerateUsageNotebook: (modelKey: string) => void;
  onEvaluateModel: (modelKey: string) => void;
  onExportModel: (modelKey: string) => void;
  onGenerateDocs: (modelKey: string) => void;
  onStageVariations: (modelKey: string) => void;
  /** Open the Blend Soup dialog (donors and weights) for this model. */
  onOpenSoupDialog: (model: ModelItem) => void;
}

interface ModelCardActionsProps extends ModelCardActionHandlers {
  model: ModelItem;
  isCurrentlyTrainingThis: boolean;
  isBusy: boolean;
  actionBusyKey: string | null;
  generatingNotebookModel: string | null;
  trainingSuiteOnline: boolean;
  /** Batch size and frozen override picked on the card. */
  localTrainSettings: LocalTrainSettings;
}

/** Action button grid of a model card: training, Kaggle sync, notebooks, evaluation, export and staging. */
export const ModelCardActions: React.FC<ModelCardActionsProps> = ({
  model: m,
  isCurrentlyTrainingThis,
  isBusy,
  actionBusyKey,
  generatingNotebookModel,
  trainingSuiteOnline,
  localTrainSettings,
  onStartLocalTrain,
  onStopLocalTrain,
  onOpenCloudModal,
  onPushArtifacts,
  onPullArtifacts,
  onGenerateTrainingNotebook,
  onGenerateUsageNotebook,
  onEvaluateModel,
  onExportModel,
  onGenerateDocs,
  onStageVariations,
  onOpenSoupDialog,
}) => {
  const trainingNotebookBusy = generatingNotebookModel === `${m.key}_training`;
  const usageNotebookBusy = generatingNotebookModel === `${m.key}_usage`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        paddingTop: "6px",
        borderTop: "1px solid var(--border-color)",
      }}
    >
      {isCurrentlyTrainingThis ? (
        <CardActionButton
          id={`train-btn-stop-${m.key}`}
          className="btn btn-danger"
          onClick={onStopLocalTrain}
          disabled={isBusy}
          icon={
            <CardIcon filled>
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </CardIcon>
          }
          label="Stop Training"
        />
      ) : (
        <CardActionButton
          id={`train-btn-start-${m.key}`}
          className="btn btn-primary"
          onClick={() => onStartLocalTrain(m, localTrainSettings)}
          disabled={isBusy || !trainingSuiteOnline}
          title={
            m.is_llm
              ? "Starts local QLoRA instruction tuning of this assistant LLM and focuses telemetry terminal below"
              : "Starts local GPU training pass and focuses telemetry terminal below"
          }
          icon={
            <CardIcon filled>
              <polygon points="6 4 20 12 6 20 6 4" />
            </CardIcon>
          }
          label="Local Training"
        />
      )}

      <CardActionButton
        id={`train-btn-cloud-${m.key}`}
        className="btn btn-cloud"
        onClick={() => onOpenCloudModal(m)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Opens Cloud Training dialog to pre-validate URLs, attached datasets, and launch on Kaggle GPU"
        icon={
          <CardIcon>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </CardIcon>
        }
        label="Cloud Training"
      />

      <CardActionButton
        id={`train-btn-pub-model-${m.key}`}
        className="btn btn-vault-push"
        onClick={() => onPushArtifacts(m.key)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Pushes all 4 model variations (PyTorch Checkpoints, PyTorch FP32, ONNX FP16, ONNX FP32) to Kaggle Models Hub"
        icon={
          <CardIcon>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </CardIcon>
        }
        label="Push Model"
      />

      <CardActionButton
        id={`train-btn-pull-model-${m.key}`}
        className="btn btn-vault-pull"
        onClick={() => onPullArtifacts(m.key)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Downloads the latest model variation from Kaggle Models Hub into local LemGendaryModels"
        icon={
          <CardIcon>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </CardIcon>
        }
        label="Pull Model"
      />

      <CardActionButton
        id={`train-btn-gen-nb-${m.key}`}
        className="btn btn-notebook-train"
        onClick={() => onGenerateTrainingNotebook(m.key)}
        disabled={isBusy || trainingNotebookBusy || !trainingSuiteOnline}
        title="Regenerates training notebooks in Model folder (both Colab and Kaggle)"
        icon={
          <CardIcon>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </CardIcon>
        }
        label={trainingNotebookBusy ? "Generating..." : "Training Notebook"}
      />

      <CardActionButton
        id={`train-btn-usage-nb-${m.key}`}
        className="btn btn-notebook-usage"
        onClick={() => onGenerateUsageNotebook(m.key)}
        disabled={isBusy || usageNotebookBusy || !trainingSuiteOnline}
        title="Regenerates standalone usage guide notebooks in Model folder (both Colab and Kaggle)"
        icon={
          <CardIcon>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </CardIcon>
        }
        label={usageNotebookBusy ? "Generating..." : "Usage Notebook"}
      />

      <CardActionButton
        id={`train-btn-eval-${m.key}`}
        className="btn btn-secondary"
        onClick={() => onEvaluateModel(m.key)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Runs evaluation on validation split and streams metrics"
        icon={
          <CardIcon>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </CardIcon>
        }
        label={actionBusyKey === `eval_${m.key}` ? "Evaluating..." : "Evaluate Model"}
      />

      <CardActionButton
        id={`train-btn-export-${m.key}`}
        className="btn btn-secondary"
        onClick={() => onExportModel(m.key)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Compiles model checkpoint into ONNX FP32/FP16 and TorchScript deployment binaries"
        icon={
          <CardIcon>
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </CardIcon>
        }
        label={actionBusyKey === `export_${m.key}` ? "Exporting..." : "Export Binaries"}
      />

      <CardActionButton
        id={`train-btn-docs-${m.key}`}
        className="btn btn-secondary"
        onClick={() => onGenerateDocs(m.key)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Regenerates Markdown Model Card (README.md) and Kaggle model-metadata.json from SSOT"
        icon={
          <CardIcon>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </CardIcon>
        }
        label={actionBusyKey === `docs_${m.key}` ? "Regenerating..." : "Docs & Meta"}
      />

      <CardActionButton
        id={`train-btn-stage-${m.key}`}
        className="btn btn-secondary"
        onClick={() => onStageVariations(m.key)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Stages exported model binaries into isolated Kaggle variation subdirectories (dist/kaggle/)"
        icon={
          <CardIcon>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </CardIcon>
        }
        label={actionBusyKey === `stage_${m.key}` ? "Staging..." : "Stage Variations"}
      />

      <CardActionButton
        id={`train-btn-soup-${m.key}`}
        className="btn btn-secondary"
        onClick={() => onOpenSoupDialog(m)}
        disabled={isBusy || !trainingSuiteOnline}
        title="Opens the Blend Soup dialog: pick vault donor checkpoints and weights (uniform by default) for one Pareto Model Soup checkpoint"
        icon={
          <CardIcon>
            <path d="M3 11h18a9 9 0 0 1-18 0z" />
            <line x1="12" y1="3" x2="12" y2="8" />
          </CardIcon>
        }
        label={actionBusyKey === `soup_${m.key}` ? "Blending..." : "Blend Soup"}
      />
    </div>
  );
};
