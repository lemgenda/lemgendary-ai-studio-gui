import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { logger } from "./utils/logger";
import { useStudioStore } from "./store/useStudioStore";

if (import.meta.env.DEV) {
  import("@axe-core/react")
    .then((axe) => {
      axe.default(React, ReactDOM, 1000);
    })
    .catch((err: unknown) => {
      logger.warn("Accessibility auditor (@axe-core/react) failed to load", err);
    });
}

// Expose store to window in DEV mode for automation and live capture
if (typeof window !== "undefined") {
  (window as unknown as { __studioStore: typeof useStudioStore }).__studioStore = useStudioStore;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
