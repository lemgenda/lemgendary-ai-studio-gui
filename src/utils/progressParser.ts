/**
 * Telemetry Progress Parser
 * Extracts structured progress metrics from operational logs across
 * Dataset Compiler, Model Training Suite, and Environment Manager.
 */

export interface ParsedProgress {
  operation: string;
  target?: string;
  percentage: number;
  isIndeterminate: boolean;
  numericStats: string;
  rate?: string;
  eta?: string;
  source: "compiler" | "training" | "pipeline" | "general";
}

const PERCENT_REGEX = /(\d{1,3}(?:\.\d+)?)\s*%/;
const BRACKET_STATS_REGEX = /\[([^\]]+)\]/;
const STEP_RATIO_REGEX = /\[Step\s+(\d+)\/(\d+)\]/i;
const BATCH_RATIO_REGEX = /\[BATCH\s+(\d+)\/(\d+)\]/i;
const EPOCH_BATCH_REGEX = /(\d+)\/(\d+)\s+(?:batches|epochs|steps|samples)/i;

export function parseProgressMessage(message: string, stepName?: string): ParsedProgress | null {
  if (!message || typeof message !== "string") return null;

  const trimmed = message.trim();
  const stepLower = (stepName || "").toLowerCase();

  // 1. Percentage check
  const percentMatch = trimmed.match(PERCENT_REGEX);
  let percentage = percentMatch ? parseFloat(percentMatch[1]) : -1;

  // 2. Step ratio check (e.g. [Step 2/6])
  const stepMatch = trimmed.match(STEP_RATIO_REGEX);
  if (percentage < 0 && stepMatch) {
    const current = parseInt(stepMatch[1], 10);
    const total = parseInt(stepMatch[2], 10);
    if (total > 0) {
      percentage = Math.min(100, Math.round((current / total) * 100));
    }
  }

  // 3. Batch ratio check (e.g. [BATCH 20/109196])
  const batchRatioMatch = trimmed.match(BATCH_RATIO_REGEX);
  if (percentage < 0 && batchRatioMatch) {
    const current = parseInt(batchRatioMatch[1], 10);
    const total = parseInt(batchRatioMatch[2], 10);
    if (total > 0) {
      percentage = Math.min(100, (current / total) * 100);
    }
  }

  // 4. Epoch/batch ratio check (e.g. 12/100 batches)
  const batchMatch = trimmed.match(EPOCH_BATCH_REGEX);
  if (percentage < 0 && batchMatch) {
    const current = parseInt(batchMatch[1], 10);
    const total = parseInt(batchMatch[2], 10);
    if (total > 0) {
      percentage = Math.min(100, Math.round((current / total) * 100));
    }
  }

  // Determine source
  let source: ParsedProgress["source"] = "general";
  if (stepLower.includes("compiler") || stepLower.includes("sync") || stepLower.includes("dataset")) {
    source = "compiler";
  } else if (
    stepLower.includes("training") ||
    stepLower.includes("epoch") ||
    stepLower.includes("model") ||
    trimmed.includes("[BATCH") ||
    trimmed.includes("EPOCH")
  ) {
    source = "training";
  } else if (stepLower.includes("step") || stepLower.includes("pipeline") || stepLower.includes("audit")) {
    source = "pipeline";
  }

  // Check if message signifies active progress
  const hasVisualBar = trimmed.includes("|") && (trimmed.includes("=") || trimmed.includes(" ") || trimmed.includes("#"));
  const hasProgressKeyword =
    trimmed.startsWith("ARCHIVING") ||
    trimmed.startsWith("PUSHING") ||
    trimmed.startsWith("EXTRACTING") ||
    trimmed.startsWith("COMPILING") ||
    trimmed.includes("EPOCH") ||
    trimmed.includes("[BATCH") ||
    trimmed.includes("batches") ||
    trimmed.includes("ETA:") ||
    trimmed.includes("it/s") ||
    trimmed.includes("MB/s");

  if (percentage < 0 && !hasVisualBar && !hasProgressKeyword) {
    return null;
  }

  // Extract operation title and target
  let operation = "PROCESSING";
  let target: string | undefined;

  if (batchRatioMatch) {
    operation = "TRAINING";
    target = `Batch ${batchRatioMatch[1]}/${batchRatioMatch[2]}`;
  } else {
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0 && colonIdx < 30) {
      operation = trimmed.substring(0, colonIdx).trim();
      const afterColon = trimmed.substring(colonIdx + 1).trim();
      const spaceIdx = afterColon.indexOf(" ");
      if (spaceIdx > 0) {
        target = afterColon.substring(0, spaceIdx).trim();
      } else {
        target = afterColon.split(/[-|[]/)[0].trim();
      }
    } else if (trimmed.toUpperCase().includes("EPOCH")) {
      operation = "TRAINING";
      const epochMatch = trimmed.match(/EPOCH\s+(\d+\/\d+)/i);
      if (epochMatch) {
        target = `Epoch ${epochMatch[1]}`;
      }
    } else if (stepName) {
      operation = stepName.toUpperCase();
    }
  }

  // Extract numeric stats inside brackets
  let numericStats = "";
  const statsMatch = trimmed.match(BRACKET_STATS_REGEX);
  if (statsMatch) {
    numericStats = statsMatch[1].trim();
  }

  // Extract rate and ETA
  let rate: string | undefined;
  let eta: string | undefined;

  const rateMatch = trimmed.match(/(\d+(?:\.\d+)?\s*(?:MB\/s|KB\/s|GB\/s|it\/s|s\/it))/i);
  if (rateMatch) {
    rate = rateMatch[1].trim();
  }

  const etaMatch = trimmed.match(/ETA:?\s*(\d+:\d+(?::\d+)?|(?:\d+[hms])+)/i);
  if (etaMatch) {
    eta = etaMatch[1].trim();
  }

  return {
    operation,
    target,
    percentage: percentage >= 0 ? Math.min(100, Math.max(0, percentage)) : 0,
    isIndeterminate: percentage < 0,
    numericStats,
    rate,
    eta,
    source,
  };
}
