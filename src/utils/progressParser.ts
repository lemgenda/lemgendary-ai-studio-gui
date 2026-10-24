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
const BATCH_RATIO_REGEX = /\[(?:VAL\s+)?BATCH\s+(\d+)\/(\d+)\]/i;
const EPOCH_BATCH_REGEX = /(\d+)\/(\d+)\s+(?:batches|epochs|steps|samples)/i;
const REQ_RATIO_REGEX = /(\d+)\/(\d+)\s+requirements/i;
const SIZE_RATIO_REGEX = /(\d+(?:\.\d+)?)\s*([KMGT]?B)?\s*\/\s*(\d+(?:\.\d+)?)\s*([KMGT]?B)?/i;

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

  // 3. Batch ratio check (e.g. [BATCH 20/109196] or [VAL BATCH 125/2500])
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

  // 5. Requirements ratio check (e.g. [12/44 requirements])
  const reqMatch = trimmed.match(REQ_RATIO_REGEX);
  if (percentage < 0 && reqMatch) {
    const current = parseInt(reqMatch[1], 10);
    const total = parseInt(reqMatch[2], 10);
    if (total > 0) {
      percentage = Math.min(100, Math.round((current / total) * 100));
    }
  }

  // 6. Download size ratio check (e.g. 1.2/2.4 GB)
  const sizeMatch = trimmed.match(SIZE_RATIO_REGEX);
  if (percentage < 0 && sizeMatch) {
    const current = parseFloat(sizeMatch[1]);
    const total = parseFloat(sizeMatch[3]);
    if (total > 0) {
      percentage = Math.min(100, (current / total) * 100);
    }
  }

  // Determine source
  let source: ParsedProgress["source"] = "general";
  if (
    stepLower.includes("compiler") ||
    stepLower.includes("dataset") ||
    trimmed.toUpperCase().includes("KAGGLE") ||
    trimmed.toUpperCase().includes("EXTRACT")
  ) {
    source = "compiler";
  } else if (
    stepLower.includes("training") ||
    stepLower.includes("validation") ||
    stepLower.includes("epoch") ||
    stepLower.includes("model") ||
    trimmed.includes("BATCH") ||
    trimmed.includes("EPOCH")
  ) {
    source = "training";
  } else if (
    stepLower.includes("step") ||
    stepLower.includes("pipeline") ||
    stepLower.includes("audit") ||
    stepLower.includes("package") ||
    stepLower.includes("installation") ||
    stepLower.includes("requirements") ||
    stepLower.includes("sync") ||
    trimmed.startsWith("INSTALLING:") ||
    trimmed.startsWith("DOWNLOADING:") ||
    trimmed.startsWith("RESOLVING:") ||
    trimmed.includes("npm install") ||
    trimmed.includes("Installing requirements for") ||
    trimmed.includes("Running npm install for")
  ) {
    source = "pipeline";
  }

  // Check if message signifies active progress
  const hasVisualBar = trimmed.includes("|") && (trimmed.includes("=") || trimmed.includes(" ") || trimmed.includes("#"));
  const hasProgressKeyword =
    trimmed.startsWith("INSTALLING") ||
    trimmed.startsWith("DOWNLOADING") ||
    trimmed.startsWith("RESOLVING") ||
    trimmed.startsWith("ARCHIVING") ||
    trimmed.startsWith("PUSHING") ||
    trimmed.startsWith("EXTRACTING") ||
    trimmed.startsWith("COMPILING") ||
    trimmed.includes("[UPLOAD]") ||
    trimmed.includes("[DOWNLOAD]") ||
    trimmed.toUpperCase().includes("KAGGLE") ||
    trimmed.toUpperCase().includes("EXTRACTION") ||
    trimmed.includes("EPOCH") ||
    trimmed.includes("BATCH") ||
    trimmed.includes("batches") ||
    trimmed.includes("ETA:") ||
    trimmed.includes("it/s") ||
    trimmed.includes("MB/s") ||
    trimmed.includes("kB/s") ||
    trimmed.includes("requirements") ||
    trimmed.includes("Installing requirements for") ||
    trimmed.includes("Running npm install for") ||
    stepLower.includes("package") ||
    stepLower.includes("installation") ||
    stepLower.includes("requirements");

  if (percentage < 0 && !hasVisualBar && !hasProgressKeyword) {
    return null;
  }

  // Extract operation title and target
  let operation = "PROCESSING";
  let target: string | undefined;

  if (batchRatioMatch) {
    const isVal = /VAL\s+BATCH/i.test(trimmed) || trimmed.toUpperCase().includes("VALLOSS");
    const isFastForward = trimmed.toUpperCase().includes("FAST-FORWARD");
    operation = isFastForward
      ? (isVal ? "FAST-FORWARD VAL" : "FAST-FORWARD TRAIN")
      : (isVal ? "VALIDATION" : "TRAINING");
    target = `${isVal ? "Val Batch" : "Batch"} ${batchRatioMatch[1]}/${batchRatioMatch[2]}`;
  } else if (trimmed.includes("Installing requirements for")) {
    const reqForMatch = trimmed.match(/Installing requirements for\s+([a-zA-Z0-9_-]+)/i);
    operation = "PACKAGE INSTALLATION";
    if (reqForMatch) {
      target = reqForMatch[1].trim();
    }
  } else if (trimmed.includes("Running npm install for")) {
    const npmForMatch = trimmed.match(/Running npm install for\s+([a-zA-Z0-9_-]+)/i);
    operation = "NPM INSTALL";
    if (npmForMatch) {
      target = npmForMatch[1].trim();
    }
  } else {
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0 && colonIdx < 30) {
      operation = trimmed.substring(0, colonIdx).trim();
      const afterColon = trimmed.substring(colonIdx + 1).trim();
      const spaceIdx = afterColon.indexOf(" ");
      let candidateTarget = "";
      if (spaceIdx > 0) {
        candidateTarget = afterColon.substring(0, spaceIdx).trim();
      } else {
        candidateTarget = afterColon.split(/[-|[]/)[0].trim();
      }
      // Target must be a genuine identifier (manifold, file, dataset, package), never a percentage or numeric rate
      if (
        candidateTarget &&
        !candidateTarget.includes("%") &&
        !PERCENT_REGEX.test(candidateTarget) &&
        !/^\d+(\.\d+)?[KMGT]?(\/\d+(\.\d+)?[KMGT]?)?$/i.test(candidateTarget) &&
        !/^(it\/s|s\/it|B\/s|KB\/s|MB\/s|GB\/s)$/i.test(candidateTarget)
      ) {
        target = candidateTarget;
      }
    } else if (trimmed.includes("[UPLOAD]") || trimmed.includes("[DOWNLOAD]") || trimmed.startsWith("PUSHING") || trimmed.includes("PUSHING ")) {
      const isPull = trimmed.includes("[DOWNLOAD]") || trimmed.includes("PULLING");
      operation = isPull ? "DOWNLOAD" : "UPLOAD";
      const pushMatch = trimmed.match(/(?:PUSHING|PULLING)\s+([a-zA-Z0-9_-]+)(?:\s*\[([^\]]+)\])?/i);
      const fleetMatch = trimmed.match(/FLEET\s+([a-zA-Z0-9_-]+)/i);
      if (pushMatch) {
        target = pushMatch[2] ? `${pushMatch[1]} [${pushMatch[2]}]` : pushMatch[1];
      } else if (fleetMatch) {
        target = `Fleet: ${fleetMatch[1]}`;
      }
    } else if (trimmed.toUpperCase().includes("KAGGLE EXTRACTION") || trimmed.toUpperCase().includes("[KAGGLE EXTRACTION]")) {
      operation = "KAGGLE EXTRACTION";
      const extractMatch = trimmed.match(/KAGGLE\s+EXTRACTION(?:\s*\([^)]+\))?[:\s-]+([^\s-]+)/i);
      if (extractMatch && !extractMatch[1].includes("%")) {
        target = extractMatch[1].trim();
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
  } else if (trimmed.includes("Installing requirements for")) {
    numericStats = "Resolving & installing dependencies...";
  } else if (trimmed.includes("Running npm install for")) {
    numericStats = "Running npm install...";
  }

  // Extract rate and ETA
  let rate: string | undefined;
  let eta: string | undefined;

  const rateMatch = trimmed.match(/(\d+(?:\.\d+)?\s*(?:MB\/s|KB\/s|GB\/s|kB\/s|it\/s|s\/it))/i);
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
