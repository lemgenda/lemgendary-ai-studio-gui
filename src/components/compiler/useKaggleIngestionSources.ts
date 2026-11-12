/**
 * LemGendary AI Studio - Kaggle state of the Dataset Compiler for the direct
 * ingestion bar: credential status (`GET /api/kaggle/status`) and the
 * registry manifolds that have a Kaggle reference (`GET /api/kaggle/registry-datasets`).
 */

import { useCallback, useEffect, useState } from "react";
import { fetchKaggleRegistryDatasets, fetchKaggleStatus } from "../../api/client";
import { KaggleDatasetRegistryItem, KaggleStatusResponse } from "../../api/types";

/** Readable names of the credential sources in `auth_methods`. */
const AUTH_METHOD_LABELS: Record<keyof KaggleStatusResponse["auth_methods"], string> = {
  environment_variables: "environment variables",
  secrets_vault: "secrets vault",
  user_access_token: "~/.kaggle/access_token",
  user_kaggle_json: "kaggle.json (legacy)",
};

/** Credential sources the Dataset Compiler found, in display form. */
export function kaggleAuthSources(status: KaggleStatusResponse): string[] {
  return (Object.keys(AUTH_METHOD_LABELS) as (keyof KaggleStatusResponse["auth_methods"])[])
    .filter((method) => status.auth_methods[method])
    .map((method) => AUTH_METHOD_LABELS[method]);
}

export interface KaggleIngestionSources {
  /** null until the first load finishes, and while the sidecar is offline. */
  status: KaggleStatusResponse | null;
  registry: KaggleDatasetRegistryItem[];
  isLoading: boolean;
  reload: () => Promise<void>;
}

/** Load both while the Dataset Compiler is online; the wrappers log failures and read as empty. */
export function useKaggleIngestionSources(datasetCompilerOnline: boolean): KaggleIngestionSources {
  const [status, setStatus] = useState<KaggleStatusResponse | null>(null);
  const [registry, setRegistry] = useState<KaggleDatasetRegistryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const [nextStatus, nextRegistry] = await Promise.all([fetchKaggleStatus(), fetchKaggleRegistryDatasets()]);
    setStatus(nextStatus);
    setRegistry(nextRegistry);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!datasetCompilerOnline) {
      setStatus(null);
      setRegistry([]);
      return;
    }
    void reload();
  }, [datasetCompilerOnline, reload]);

  return { status, registry, isLoading, reload };
}
