import React from "react";
import { ValidationBanner } from "../common/ValidationBanner";
import { PresetOptions } from "./PresetOptions";
import { DatasetCompilationFormProps } from "./DatasetCompilationForm";

type CustomCompileFormProps = Pick<
  DatasetCompilationFormProps,
  | "presets"
  | "presetsError"
  | "customName"
  | "onChangeCustomName"
  | "customTask"
  | "onChangeCustomTask"
  | "customPreset"
  | "onChangeCustomPreset"
  | "customCanonicalFormat"
  | "onChangeCustomCanonicalFormat"
  | "customShardSize"
  | "onChangeCustomShardSize"
  | "customSourcesText"
  | "onChangeCustomSourcesText"
  | "customPurgeLoose"
  | "onToggleCustomPurgeLoose"
  | "isCustomCompiling"
  | "customCompileStatus"
  | "onDismissCustomCompileStatus"
  | "onCustomCompile"
  | "datasetCompilerOnline"
>;

/** Custom mode: compile a new manifold from multiple Kaggle, Hugging Face, Google Drive or GitHub sources. */
export const CustomCompileForm: React.FC<CustomCompileFormProps> = ({
  presets,
  presetsError,
  customName,
  onChangeCustomName,
  customTask,
  onChangeCustomTask,
  customPreset,
  onChangeCustomPreset,
  customCanonicalFormat,
  onChangeCustomCanonicalFormat,
  customShardSize,
  onChangeCustomShardSize,
  customSourcesText,
  onChangeCustomSourcesText,
  customPurgeLoose,
  onToggleCustomPurgeLoose,
  isCustomCompiling,
  customCompileStatus,
  onDismissCustomCompileStatus,
  onCustomCompile,
  datasetCompilerOnline,
}) => (
  <div>
    <div className="form-grid form-grid-custom">
      <div className="form-group">
        <label htmlFor="custom-name-input" className="form-field-label">
          Manifold Name:
        </label>
        <input
          id="custom-name-input"
          type="text"
          className="editor-input form-control-sm"
          placeholder="e.g. FineArtPortraitsV1"
          value={customName}
          onChange={(e) => onChangeCustomName(e.target.value)}
          disabled={isCustomCompiling}
        />
      </div>

      <div className="form-group">
        <label htmlFor="custom-task-select" className="form-field-label">
          Task Category:
        </label>
        <select
          id="custom-task-select"
          className="editor-select form-control-sm"
          value={customTask}
          onChange={(e) => onChangeCustomTask(e.target.value)}
          disabled={isCustomCompiling}
        >
          <option value="restoration">Restoration &amp; Enhancement</option>
          <option value="detection">Detection &amp; Localization</option>
          <option value="classification">Classification &amp; Filtering</option>
          <option value="quality">Aesthetic &amp; Quality Scoring</option>
          <option value="vision">General Computer Vision</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="custom-format-select" className="form-field-label">
          Container Format:
        </label>
        <select
          id="custom-format-select"
          className="editor-select form-control-sm"
          value={customCanonicalFormat}
          onChange={(e) =>
            onChangeCustomCanonicalFormat(
              e.target.value as "webdataset" | "parquet" | "mds" | "litdata"
            )
          }
          disabled={isCustomCompiling}
        >
          <option value="webdataset">WebDataset Streaming (.data shards)</option>
          <option value="parquet">Columnar Parquet (.parquet)</option>
          <option value="mds">MosaicML Streaming (.mds shards)</option>
          <option value="litdata">PyTorch Lightning LitData (.bin)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="custom-preset-select" className="form-field-label">
          Compression Profile:
        </label>
        <select
          id="custom-preset-select"
          className="editor-select form-control-sm"
          value={customPreset}
          onChange={(e) => onChangeCustomPreset(e.target.value)}
          disabled={isCustomCompiling}
        >
          <PresetOptions presets={presets} presetsError={presetsError} />
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="custom-shard-size" className="form-field-label">
          Samples Per Shard:
        </label>
        <input
          id="custom-shard-size"
          type="number"
          className="editor-input form-control-sm"
          value={customShardSize}
          onChange={(e) => onChangeCustomShardSize(Number(e.target.value))}
          disabled={isCustomCompiling}
          min={100}
          max={50000}
        />
      </div>

      <div className="form-group custom-purge-row">
        <input
          id="custom-purge-check"
          type="checkbox"
          checked={customPurgeLoose}
          onChange={(e) => onToggleCustomPurgeLoose(e.target.checked)}
          disabled={isCustomCompiling}
        />
        <label htmlFor="custom-purge-check" className="checkbox-label">
          Purge loose source images
        </label>
      </div>
    </div>

    <div className="form-group custom-sources-field">
      <div className="custom-sources-header">
        <label htmlFor="custom-sources-area" className="form-field-label-caps">
          Source Repositories &amp; URLs (One per line):
        </label>
        <span className="custom-sources-hint">
          Prefixes: kaggle:// | hf:// | gd:// | gh:// or raw URLs
        </span>
      </div>
      <textarea
        id="custom-sources-area"
        className="editor-textarea custom-sources-textarea"
        rows={3}
        placeholder={
          "# Enter source repositories or direct links, one per line:\nkaggle://username/dataset-slug\nhttps://huggingface.co/datasets/org/dataset-name\nhttps://github.com/owner/repository"
        }
        value={customSourcesText}
        onChange={(e) => onChangeCustomSourcesText(e.target.value)}
        disabled={isCustomCompiling}
      />
    </div>

    <div className="row-gap-lg">
      <button
        type="button"
        className="btn btn-primary btn-action-bold"
        onClick={onCustomCompile}
        disabled={isCustomCompiling || !datasetCompilerOnline}
      >
        {isCustomCompiling ? "Compiling Custom Manifold..." : "Compile Custom Dataset"}
      </button>
    </div>

    {customCompileStatus && (
      <ValidationBanner
        message={customCompileStatus}
        onDismiss={onDismissCustomCompileStatus}
        className="banner-space-top-sm banner-text-sm"
      />
    )}
  </div>
);
