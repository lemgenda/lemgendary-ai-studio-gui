import React, { useState } from "react";

/** Local training batch sizes offered on a model card. */
const BATCH_SIZES: readonly number[] = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

/** Select value that switches to the free batch size input. */
const CUSTOM_OPTION = "custom";

interface BatchSizeSelectorProps {
  modelKey: string;
  value: number;
  onChange: (batchSize: number) => void;
  disabled: boolean;
  modelName: string;
}

/** A positive whole batch size, or null. */
function parseBatchSize(text: string): number | null {
  const value = Number(text);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/** Batch size of a local training run: a preset size or a custom whole number. */
export const BatchSizeSelector: React.FC<BatchSizeSelectorProps> = ({ modelKey, value, onChange, disabled, modelName }) => {
  // Custom entry chosen by the user; a non-preset value from the registry also shows the input.
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>(String(value));
  const showCustom = isCustom || !BATCH_SIZES.includes(value);
  const customDisplay = isCustom ? customText : String(value);
  const customInvalid = showCustom && parseBatchSize(customDisplay) === null;

  const handleSelect = (selected: string) => {
    if (selected === CUSTOM_OPTION) {
      setIsCustom(true);
      setCustomText(String(value));
      return;
    }
    setIsCustom(false);
    onChange(Number(selected));
  };

  const handleCustom = (text: string) => {
    setIsCustom(true);
    setCustomText(text);
    const parsed = parseBatchSize(text);
    if (parsed !== null) onChange(parsed);
  };

  return (
    <div className="batch-selector-row">
      <span className="batch-selector-label">
        Batch Size:
      </span>
      <div className="row-gap-sm">
        <select
          id={`train-select-batch-${modelKey}`}
          className="batch-control"
          value={showCustom ? CUSTOM_OPTION : String(value)}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={disabled}
          aria-label={`Select local batch size for ${modelName}`}
        >
          {BATCH_SIZES.map((size) => (
            <option key={size} value={String(size)}>
              {size}
            </option>
          ))}
          <option value={CUSTOM_OPTION}>Custom...</option>
        </select>
        {showCustom && (
          <input
            id={`train-input-custom-batch-${modelKey}`}
            type="number"
            min={1}
            step={1}
            className={`batch-control batch-control-custom ${customInvalid ? "batch-control-invalid" : ""}`}
            value={customDisplay}
            onChange={(e) => handleCustom(e.target.value)}
            disabled={disabled}
            aria-label={`Custom local batch size for ${modelName}`}
            aria-invalid={customInvalid}
            title={customInvalid ? "Enter a whole number of 1 or more" : undefined}
          />
        )}
      </div>
    </div>
  );
};
