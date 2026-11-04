#!/usr/bin/env node
/**
 * Copies the ecosystem SSOT file from the sibling Environment Manager repo
 * into src/generated/ecosystem.json (committed snapshot).
 *
 * Source resolution order:
 *   1. LEMGENDARY_ECOSYSTEM_FILE
 *   2. <LEMGENDARY_WORKSPACE_ROOT or repo parent>/lemgendary-env-manager/ecosystem/ecosystem.json
 *
 * Modes:
 *   (default)  source present -> copy when different; source missing -> keep the
 *              committed snapshot with a warning (fail when there is no snapshot).
 *   --check    source present and snapshot differs -> exit 1 (CI drift check);
 *              source missing -> warn and keep the snapshot.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = join(repoRoot, "src", "generated", "ecosystem.json");
const checkOnly = process.argv.includes("--check");

function sourcePath() {
  if (process.env.LEMGENDARY_ECOSYSTEM_FILE) {
    return resolve(process.env.LEMGENDARY_ECOSYSTEM_FILE);
  }
  const workspaceRoot = process.env.LEMGENDARY_WORKSPACE_ROOT
    ? resolve(process.env.LEMGENDARY_WORKSPACE_ROOT)
    : resolve(repoRoot, "..");
  return join(workspaceRoot, "lemgendary-env-manager", "ecosystem", "ecosystem.json");
}

/** Line endings differ between checkouts (core.autocrlf); content must not. */
const normalize = (text) => text.replace(/\r\n/g, "\n");

function readParsed(path) {
  const text = readFileSync(path, "utf8");
  try {
    JSON.parse(text);
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return text;
}

function main() {
  const source = sourcePath();
  const snapshotExists = existsSync(snapshotPath);

  if (!existsSync(source)) {
    if (!snapshotExists) {
      console.error(`[sync-ecosystem] ERROR: source ${source} is missing and no snapshot exists at ${snapshotPath}.`);
      return 1;
    }
    console.warn(`[sync-ecosystem] WARNING: source ${source} not found; keeping the committed snapshot (may be stale).`);
    return 0;
  }

  const sourceText = readParsed(source);
  const snapshotText = snapshotExists ? readFileSync(snapshotPath, "utf8") : null;
  const inSync = snapshotText !== null && normalize(snapshotText) === normalize(sourceText);

  if (inSync) {
    console.log("[sync-ecosystem] snapshot is up to date.");
    return 0;
  }
  if (checkOnly) {
    console.error(`[sync-ecosystem] ERROR: ${snapshotPath} differs from ${source}. Run "npm run sync:ecosystem" and commit the result.`);
    return 1;
  }
  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, normalize(sourceText), "utf8");
  console.log(`[sync-ecosystem] copied ${source} -> ${snapshotPath}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`[sync-ecosystem] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
