import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Vitest replaces CSS with an empty module unless it is included here; the
// CSS class coverage test reads `src/index.css` through `?raw`.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      css: { include: [/src[\\/]index\.css/] },
    },
  })
);
