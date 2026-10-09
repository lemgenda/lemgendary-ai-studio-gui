import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const cleanLogger = createLogger();
const emojiRegex = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{10000}-\u{10FFFF}]/gu;
const sanitizeText = (msg: string) => msg.replace(emojiRegex, "");
const origInfo = cleanLogger.info.bind(cleanLogger);
const origWarn = cleanLogger.warn.bind(cleanLogger);
const origError = cleanLogger.error.bind(cleanLogger);

cleanLogger.info = (msg, options) => origInfo(sanitizeText(msg), options);
cleanLogger.warn = (msg, options) => origWarn(sanitizeText(msg), options);
cleanLogger.error = (msg, options) => origError(sanitizeText(msg), options);

// https://vitejs.dev/config/
export default defineConfig({
  customLogger: cleanLogger,
  optimizeDeps: {
    include: ["@tauri-apps/api/core"],
  },
  plugins: [
    react(),
    {
      name: "serve-offline-docs",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith("/documentation-hub")) {
            let relativePath = req.url.replace(/^\/documentation-hub\/?/, "") || "index.html";
            relativePath = relativePath.split("?")[0].split("#")[0];
            const filePath = path.resolve(__dirname, "../lemgendary-docs", relativePath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const contentTypes: Record<string, string> = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".md": "text/markdown",
              };
              res.setHeader("Content-Type", contentTypes[ext] || "text/plain; charset=utf-8");
              res.end(fs.readFileSync(filePath));
              return;
            }
          }

          if (req.url && req.url.startsWith("/api/model-telemetry/")) {
            const modelKey = req.url.replace(/^\/api\/model-telemetry\/?/, "").split("?")[0];
            const candidatePaths = [
              path.resolve(__dirname, "../LemGendaryModels", modelKey, "metrics.csv"),
              path.resolve(__dirname, "../lemgendary-training-suite/checkpoints", modelKey, "metrics.csv"),
            ];
            let activeCsv: string | null = null;
            let latestMtime = 0;
            for (const p of candidatePaths) {
              if (fs.existsSync(p)) {
                const stat = fs.statSync(p);
                if (stat.mtimeMs > latestMtime && stat.size > 0) {
                  latestMtime = stat.mtimeMs;
                  activeCsv = p;
                }
              }
            }

            if (activeCsv) {
              try {
                const lines = fs.readFileSync(activeCsv, "utf-8").trim().split(/\r?\n/);
                if (lines.length > 1) {
                  const header = lines[0].split(",");
                  const resIdx = header.findIndex((h) => /^(res|resolution|imgsz)$/i.test(h.trim()));
                  const dataIdx = header.findIndex((h) => /^(data|data_fraction|sample_fraction)$/i.test(h.trim()));
                  const epIdx = header.findIndex((h) => /^epoch$/i.test(h.trim()));

                  const lastLine = lines[lines.length - 1].split(",");
                  const resVal = resIdx >= 0 ? parseInt(lastLine[resIdx], 10) : null;
                  let dataVal = dataIdx >= 0 ? parseFloat(lastLine[dataIdx].replace("%", "").trim()) : null;
                  if (dataVal !== null && dataVal > 1.0) dataVal = dataVal / 100.0;
                  const epVal = epIdx >= 0 ? parseInt(lastLine[epIdx], 10) : null;

                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({
                    model_key: modelKey,
                    latest_res: !isNaN(resVal as number) ? resVal : null,
                    latest_data: !isNaN(dataVal as number) ? dataVal : null,
                    latest_epoch: !isNaN(epVal as number) ? epVal : null,
                  }));
                  return;
                }
              } catch {
                // fall through
              }
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ model_key: modelKey, latest_res: null, latest_data: null }));
            return;
          }
          next();
        });
      },
    },
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
