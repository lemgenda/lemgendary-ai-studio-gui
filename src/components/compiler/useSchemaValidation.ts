/**
 * LemGendary AI Studio - "Validate Schema" action of the compiler toolbar:
 * checks `unified_data.yaml` against the Dataset Compiler's config schema.
 */

import { useState } from "react";
import { validateCompilerConfig } from "../../api/client";
import { ConfigValidationResponse } from "../../api/types";
import { servicePort } from "../../api/config";
import { BannerType } from "../common/ValidationBanner";

export interface SchemaValidationNotice {
  type: Extract<BannerType, "success" | "error">;
  message: string;
}

export interface SchemaValidationControls {
  isValidatingSchema: boolean;
  schemaNotice: SchemaValidationNotice | null;
  onValidateSchema: () => Promise<void>;
  onDismissSchemaNotice: () => void;
}

/** One-line summary of a valid registry. */
export function describeSchemaValidation(res: ConfigValidationResponse): string {
  return (
    `Schema valid: unified_data.yaml v${res.version}, ${res.dataset_count} datasets ` +
    `(prefix '${res.prefix}', suffix '${res.suffix}', output folder '${res.output_folder}').`
  );
}

export function useSchemaValidation(datasetCompilerOnline: boolean): SchemaValidationControls {
  const [isValidatingSchema, setIsValidatingSchema] = useState<boolean>(false);
  const [schemaNotice, setSchemaNotice] = useState<SchemaValidationNotice | null>(null);

  const onValidateSchema = async () => {
    if (!datasetCompilerOnline) {
      setSchemaNotice({
        type: "error",
        message: `Schema validation failed: Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is offline.`,
      });
      return;
    }
    setIsValidatingSchema(true);
    setSchemaNotice(null);
    try {
      setSchemaNotice({ type: "success", message: describeSchemaValidation(await validateCompilerConfig()) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setSchemaNotice({ type: "error", message: `Schema validation failed: ${msg}` });
    } finally {
      setIsValidatingSchema(false);
    }
  };

  return {
    isValidatingSchema,
    schemaNotice,
    onValidateSchema,
    onDismissSchemaNotice: () => setSchemaNotice(null),
  };
}
