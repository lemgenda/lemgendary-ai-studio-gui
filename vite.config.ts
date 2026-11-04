import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";

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
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
