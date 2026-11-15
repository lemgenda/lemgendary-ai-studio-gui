import React from "react";
import { CompilerPreset } from "../../api/types";

export interface PresetOptionsProps {
  presets: CompilerPreset[];
  presetsError: string | null;
  selectedPreset?: string;
}

/** Preset choices: the sidecar default (preset omitted) plus every preset the server reports. */
export const PresetOptions: React.FC<PresetOptionsProps> = ({
  presets,
  presetsError,
  selectedPreset,
}) => {
  const hasSelectedInPresets =
    !selectedPreset || presets.some((p) => p.name === selectedPreset);

  return (
    <>
      <option value="">
        {presetsError
          ? "Server default (preset list unavailable: sidecar offline)"
          : "Server default (presets.yaml default_preset)"}
      </option>
      {!hasSelectedInPresets && selectedPreset && (
        <option key={selectedPreset} value={selectedPreset}>
          {selectedPreset} (recommended)
        </option>
      )}
      {presets.map((p) => (
        <option key={p.name} value={p.name} title={p.description}>
          {p.title ? `${p.title} (${p.name})` : p.name}
        </option>
      ))}
    </>
  );
};
