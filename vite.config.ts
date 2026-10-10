import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import net from "net";
import { spawn } from "child_process";

const cleanLogger = createLogger();
const emojiRegex = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{10000}-\u{10FFFF}]/gu;
const sanitizeText = (msg: string) => msg.replace(emojiRegex, "");
const origInfo = cleanLogger.info.bind(cleanLogger);
const origWarn = cleanLogger.warn.bind(cleanLogger);
const origError = cleanLogger.error.bind(cleanLogger);

cleanLogger.info = (msg, options) => origInfo(sanitizeText(msg), options);
cleanLogger.warn = (msg, options) => origWarn(sanitizeText(msg), options);
cleanLogger.error = (msg, options) => origError(sanitizeText(msg), options);

function isPortHealthy(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => {
      sock.destroy();
      resolve(false);
    });
    sock.on("timeout", () => {
      sock.destroy();
      resolve(false);
    });
    sock.connect(port, "127.0.0.1");
  });
}

interface ServiceDefinition {
  folder: string;
  appModule: string;
  port: number;
  name: string;
}

const SERVICE_REGISTRY: Record<string, ServiceDefinition> = {
  "env-manager": {
    folder: "lemgendary-env-manager",
    appModule: "env_manager.server:app",
    port: 8000,
    name: "LemGendary Environment Manager",
  },
  "dataset-compiler": {
    folder: "lemgendary-datasets",
    appModule: "api.server:app",
    port: 8100,
    name: "LemGendary Dataset Compiler Suite",
  },
  "training-suite": {
    folder: "lemgendary-training-suite",
    appModule: "training.server.app:app",
    port: 8200,
    name: "LemGendary Model Training Suite",
  },
};

function spawnSidecarDaemon(projectFolder: string, appModule: string, port: number): boolean {
  const projDir = path.resolve(__dirname, `../${projectFolder}`);
  const isWin = process.platform === "win32";

  let pythonExe = "python";
  if (isWin) {
    const venvPythonw = path.join(projDir, ".venv", "Scripts", "pythonw.exe");
    const venvPython = path.join(projDir, ".venv", "Scripts", "python.exe");
    if (fs.existsSync(venvPythonw)) {
      pythonExe = venvPythonw;
    } else if (fs.existsSync(venvPython)) {
      pythonExe = venvPython;
    }
  } else {
    const venvPython = path.join(projDir, ".venv", "bin", "python");
    if (fs.existsSync(venvPython)) {
      pythonExe = venvPython;
    } else {
      pythonExe = "python3";
    }
  }

  try {
    const child = spawn(
      pythonExe,
      ["-m", "uvicorn", appModule, "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: projDir,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }
    );
    child.unref();
    return true;
  } catch (err) {
    cleanLogger.error(`Failed to spawn sidecar ${projectFolder} on port ${port}: ${String(err)}`);
    return false;
  }
}

async function waitForPortHealth(port: number, maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isPortHealthy(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return false;
}

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
          if (req.url === "/api/dev/services/start-all" && req.method === "POST") {
            (async () => {
              try {
                const results: Record<string, { status: string; port: number; message: string }> = {};

                for (const [id, cfg] of Object.entries(SERVICE_REGISTRY)) {
                  const online = await isPortHealthy(cfg.port);
                  if (online) {
                    results[id] = {
                      status: "already_running",
                      port: cfg.port,
                      message: `${cfg.name} is already online.`,
                    };
                  } else {
                    spawnSidecarDaemon(cfg.folder, cfg.appModule, cfg.port);
                  }
                }

                // Wait for all offline services to finish port binding
                for (const [id, cfg] of Object.entries(SERVICE_REGISTRY)) {
                  if (results[id]?.status !== "already_running") {
                    const ok = await waitForPortHealth(cfg.port, 15000);
                    results[id] = {
                      status: ok ? "started" : "error",
                      port: cfg.port,
                      message: ok
                        ? `${cfg.name} started successfully.`
                        : `Failed to start ${cfg.name}.`,
                    };
                  }
                }

                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ results }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: String(err) }));
              }
            })();
            return;
          }

          if (req.url === "/api/dev/services/start" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body || "{}");
                const serviceId: string = parsed.serviceId || "env-manager";
                const cfg = SERVICE_REGISTRY[serviceId];

                if (!cfg) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: `Unknown service ${serviceId}` }));
                  return;
                }

                // If this single service is already online, return immediately
                const alreadyRunning = await isPortHealthy(cfg.port);
                if (alreadyRunning) {
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({
                    status: "already_running",
                    port: cfg.port,
                    message: `${cfg.name} is already online on port ${cfg.port}.`,
                  }));
                  return;
                }

                // Spawn ONLY this single requested service
                spawnSidecarDaemon(cfg.folder, cfg.appModule, cfg.port);
                const ok = await waitForPortHealth(cfg.port, 15000);

                res.statusCode = ok ? 200 : 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  status: ok ? "started" : "error",
                  port: cfg.port,
                  message: ok
                    ? `${cfg.name} started successfully on port ${cfg.port}.`
                    : `Failed to start ${cfg.name} on port ${cfg.port}.`,
                }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: String(err) }));
              }
            });
            return;
          }

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
