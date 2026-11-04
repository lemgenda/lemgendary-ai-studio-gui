import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { logger } from "./utils/logger";

if (import.meta.env.DEV) {
  import("@axe-core/react")
    .then((axe) => {
      axe.default(React, ReactDOM, 1000);
    })
    .catch((err: unknown) => {
      logger.warn("Accessibility auditor (@axe-core/react) failed to load", err);
    });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
