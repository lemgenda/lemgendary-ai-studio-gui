import packageJson from "../package.json";

/**
 * GUI version (the `vX.Y.Z` line in README.md's changelog). `package.json`
 * holds it; `src-tauri/tauri.conf.json` reads the same field.
 */
export const APP_VERSION: string = `v${packageJson.version}`;
