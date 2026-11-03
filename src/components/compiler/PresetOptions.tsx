import React from "react";
import { CompilerPreset } from "../../api/types";

/** Preset choices: the sidecar default (preset omitted) plus every preset the server reports. */
export const PresetOptions: React.FC<{ presets: CompilerPreset[]; presetsError: string | null }> = ({ presets, presetsError }) => (
  <>
    <option value="">
      {presetsError ? "Server default (preset list unavailable: sidecar offline)" : "Server default (presets.yaml default_preset)"}
    </option>
    {presets.map((p) => (
      <option key={p.name} value={p.name} title={p.description}>
        {p.title ? `${p.title} (${p.name})` : p.name}
      </option>
    ))}
  </>
);
