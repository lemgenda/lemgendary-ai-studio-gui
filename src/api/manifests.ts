/**
 * LemGendary AI Studio - Universal Manifest & Registry Editor (Environment Manager).
 */

import { ENV_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { ManifestItem, ManifestReadResponse, ManifestSaveResponse, ManifestValidateResponse } from "./types";

export async function fetchManifestRegistry(): Promise<ManifestItem[]> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/registry`);
  if (!res.ok) throw new Error(`Failed to fetch manifest registry: ${res.statusText}`);
  const data = await res.json();
  return data.manifests || [];
}

export async function readManifest(name: string): Promise<ManifestReadResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/read?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to read manifest '${name}': ${res.statusText}`);
  return res.json();
}

export async function validateManifest(name: string, content: string): Promise<ManifestValidateResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error(`Failed to validate manifest: ${res.statusText}`);
  return res.json();
}

export async function saveManifest(name: string, content: string): Promise<ManifestSaveResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error(`Failed to save manifest: ${res.statusText}`);
  return res.json();
}
