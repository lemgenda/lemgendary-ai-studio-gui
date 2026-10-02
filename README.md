# LemGendary AI Studio GUI

Modern cross-platform desktop user interface for the LemGendary AI ecosystem, built with Tauri v2, React 18, TypeScript, and Vite.

## Architectural Overview

LemGendary AI Studio operates as a unified client communicating across a tripartite local microservice topology:

1. **Environment Manager Sidecar (`lemgendary-env-manager` on Port 8000)**:
   - System hardware detection (`GET /api/system/hardware`).
   - Multi-project virtual environment lifecycle management and drift matrix.
   - Deterministic 7-step clean install orchestrator (`POST /api/pipeline/install`).
   - Ecosystem-wide compliance validation.

2. **Dataset Compiler Sidecar (`lemgendary-datasets` on Port 8100)**:
   - Manifold catalog and format inspection (`GET /api/compiler/manifolds`, `GET /api/compiler/formats`).
   - Direct streaming WebDataset `.tar` sharding and lossless WebP transcoding.
   - Multi-source dataset ingestion (Kaggle, HuggingFace, Google Drive, GitHub) and migration.

3. **Training Suite Sidecar (`lemgendary-training-suite` on Port 8200)**:
   - Neural architecture registry and model cards (`GET /api/training/models`).
   - Dynamic spatial ladder training dispatch and Sawtooth Governor VRAM telemetry.
   - Diagnostic single-epoch validation and ONNX/Safetensors export packaging.

## Core Interface Capabilities

- **Universal Dynamic Configuration & Registry Editor**:
  - In-app modal for viewing, modifying, and validating core manifests: `unified_data.yaml`, `unified_models_v2.yaml`, `config.yaml`, `presets.yaml`, `runtime_env.yaml`, `requirements.txt`, and `package.json`.
  - In-app syntax checking, schema validation, visual diff preview, and atomic backup writing.

- **Dataset Compiler & Modernization Suite**:
  - **Standard Compilation**: Fast transformation of raw archives into WebDataset `.tar` shards, Parquet, MosaicML `.mds`, or LitData containers.
  - **Custom Multi-Source Dataset Compilation**: Synthesize new custom manifolds by supplying lists of source datasets from Kaggle (`kaggle://`), HuggingFace (`hf://`), Google Drive (`gd://`), or GitHub (`gh://`).
  - **Kaggle Cloud Synchronization & Storage Hub**: Bi-directional cloud syncing: download pre-configured manifolds from `unified_data.yaml`, download custom datasets via direct URL or slug, and publish local compiled manifolds.
  - **Production Manifolds Catalog**: Real-time status, format breakdowns, sample counts, and disk metrics across all 22 production manifolds.

- **Training Manifold & SOTA Model Cards**:
  - **Interactive Topology Catalog**: Real-time model cards displaying neural architecture, parameter counts, primary targets, SOTA target progress counters (`X / Y Met`), Resolution Ladder progress, and Data Fraction completion.
  - **Strict 3-Pillar Convergence Badges**: Model cards authoritatively evaluate `FULLY TRAINED` (all SOTA targets met + entire ladder passed + 100% data fraction), `PARTIALLY TRAINED`, `WEIGHTS READY`, and `INITIALIZING`.
  - **Adaptive Domain Controls**: Selecting `forex_predictor` dynamically switches dropdowns from "Spatial Ladder Stage" to **"Timeframe Confluence Stage"** with MetaTrader 5 horizons (`M1 Scalping`, `M5 Order Flow`, `M15 Trigger`, `H1 Trend`, `H4 Momentum`, `D1 Macro Confluence`).

- **Contextual UX Help & Interactive Hover Guidance**:
  - Every interactive UI element (action buttons, navigation menu items, slider governors, toggle switches, form inputs, and status badges) features an inline help icon badge.
  - Hovering over any help icon displays an elevated glassmorphic tooltip card explaining the control's function, associated CLI/API command, and operational side effects.

- **Real-Time Telemetry & Diagnostics**:
  - Streaming WebSockets over `/ws/log` and `/api/ws/logs` with color-coded severity badges (`[INFO]`, `[SUCCESS]`, `[WARNING]`, `[ERROR]`).
  - Memory-efficient circular log buffers and smart auto-scroll controls.

## Design Aesthetics

- **Curated Palette**: Deep slate background (`#0a0d14`), subtle border contrast (`#243252`), cyan (`#06b6d4`) and purple (`#8b5cf6`) accents.
- **Micro-Animations & Smooth Transitions**: Polished hover effects and active state styling.
- **Accessibility & UX**: Accessible ARIA labels and tooltips complying with WCAG 2.2 standards.
- **Strict Zero-Emoji Policy**: Clean, text-only, enterprise-grade interface.

## Development Setup

```bash
# Install NPM dependencies
npm install

# Run Vite development server
npm run dev

# Run Tauri desktop application in development mode
npm run tauri dev

# Run component unit and smoke tests
npm test

# Build production bundle
npm run build
```

## Ecosystem Validation

The desktop application complies with LemGendary ecosystem standards:

```bash
lem-env validate --project lemgendary-ai-studio-gui
```

## Changelog

### v2.7.0 — Training Orchestration Form Stabilization & Dynamic Model Defaults

- **`src/components/TrainingPanel.tsx` — Layout Collision Resolution** — Separated `Target Architecture` into a dedicated hero selector row with real-time architectural metadata badges (task category, parameter count, canonical format, preferred parallel mode). Restructured training parameters (`Training Epochs`, `Minibatch Size`, `Initial Learning Rate`, and `Ladder Stage`) into a dedicated 4-column responsive grid with `min-width: 0` constraints, eliminating horizontal overlap and input clipping.
- **`src/components/TrainingPanel.tsx` — Dynamic Hyperparameter Synchronization** — Implemented `applyModelDefaults` to automatically populate model-specific defaults when switching architectures (e.g., YOLOv8n sets 300 epochs, 0.01 learning rate, 16 batch size, and 640px stage; Forex Predictor sets 50 epochs, 0.0001 learning rate, 128 batch size, and D1 macro horizon).
- **`src/components/TrainingPanel.tsx` — Governor Toggle Card & Dispatch Wiring** — Upgraded the Sawtooth VRAM Governor into a dedicated glassmorphic card with live active sentinel status badge. Forwarded `ladder_stage` and `enable_sawtooth` parameters through `triggerQuickTrain` to the training suite sidecar.
- **`src/index.css` — Form Control Hardening** — Added `.form-group` and `.form-group .editor-select, .editor-input` width constraints (`box-sizing: border-box; width: 100%; min-width: 0`) preventing select boxes with long option titles from blowing out grid layouts.

### v2.1.0 — Tripartite Sidecar Mesh Status Integration (GUI Remediation Phase A1)

- **`src/api/types.ts` — `MeshStatus` Interface** — Added shared `MeshStatus` interface (`{ envManager: boolean; datasetCompiler: boolean; trainingSuite: boolean }`) used across `App`, `Sidebar`, and `StatusBar` for unified per-port awareness.
- **`src/api/client.ts` — `probeSidecarPort(port)`** — Added lightweight HEAD-request reachability probe with a 1500 ms `AbortController` timeout as a fallback for when port 8000 is itself offline and `fetchEcosystemMesh()` cannot be called. Also re-exports `MeshStatus` for convenience.
- **`src/App.tsx` — Mesh State Hydration** — Added `meshStatus` state (initially all `false`). `loadData()` now attempts `fetchEcosystemMesh()` first; on failure it falls back to three parallel `probeSidecarPort()` calls covering ports 8000, 8100, and 8200. Passes `meshStatus` to `Sidebar` and `StatusBar`.
- **`src/components/Sidebar.tsx` — Per-Tab Sidecar Status Dots** — Added `meshStatus: MeshStatus` prop. Each navigation tab now renders a colored `.status-indicator` dot reflecting the reachability of its dependent sidecar (Dataset Compiler tab → port 8100, Training Suite tab → port 8200, all others → port 8000).
- **`src/components/StatusBar.tsx` — Tripartite Port Status Display** — Replaced single `isConnected: boolean` prop with `meshStatus: MeshStatus`. Status bar now renders three individual port entries (Env Manager :8000, Dataset Compiler :8100, Training Suite :8200) each with their own status dot, plus a composite `Mesh Online / Mesh Partial / Mesh Offline` summary badge.

### v2.2.0 — Offline Fallback Hydration (GUI Remediation Phase A2)

- **`src/components/HardwareCard.tsx` — Offline Card** — Replaced permanent `Loading hardware profile...` spinner with a proper OFFLINE badge card explaining Port 8000 is unreachable. Accepts optional `onStartEnvManager` prop to render a `Start Environment Manager` button.
- **`src/components/HealthPanel.tsx` — Offline Banner** — Replaced permanent `Loading health matrix...` spinner with an OFFLINE banner explaining the dependency on Port 8000. Accepts optional `onStartEnvManager` prop.
- **`src/components/ProjectCard.tsx` — Offline Visual Mode** — Added `isOffline?: boolean` prop. When true: badge shows `UNKNOWN`, package counts render as `--`, and the reconcile button shows `(Sidecar Required)` and is disabled.
- **`src/components/Header.tsx` — Docs Hub Smart Routing** — Fixed `Docs Hub (Offline)` button which previously caused `ERR_CONNECTION_REFUSED` when Port 8000 is down. Now calls `fetchDocsStatus()` on click and opens the offline URL only if `offline_available` is true, otherwise falls back to the GitHub Pages web URL. Button label dynamically reads `Docs Hub (Offline)` vs `Docs (Web Fallback)` based on `envManagerOnline` prop.
- **`src/App.tsx` — FALLBACK_PROJECTS + Error Banners + Offline Wiring** — Added `FALLBACK_PROJECTS` constant (all 5 canonical workspace projects) displayed when `health` is null. Added `refreshError` state surfaced as a dismissible amber banner. Added global red offline banner with `Start All Services` button when all 3 sidecars are down. All previously silent `catch` blocks now call `setRefreshError` with actionable messages. `handleStartEcosystem` navigates to the pipeline tab and triggers the clean install. All new `onStartEnvManager`, `envManagerOnline`, and `isOffline` props wired throughout.

### v2.3.0 — Dashboard Service Control Plane Restoration (GUI Remediation Phase A3)

- **`src/components/ServiceTiles.tsx` — New Component** — Tripartite sidecar service control plane rendered as three cards in a 3-column CSS grid at the top of the Dashboard. Each card shows: service name, ONLINE/OFFLINE badge (border turns red when offline), port number, base URL, description, and a context-appropriate quick-action button (disabled when offline). An additional `Start Service` primary button appears only when the sidecar is offline and routes to `handleStartEcosystem`. Cards cover Env Manager (:8000), Dataset Compiler (:8100), and Training Suite (:8200). Base URL constants (`ENV_BASE`, `DATASETS_BASE`, `TRAINING_BASE`) imported directly from `client.ts`.
- **`src/App.tsx` — ServiceTiles Integration** — `ServiceTiles` inserted as the first element inside the dashboard tab fragment, above the `HardwareCard`/`PipelinePanel` grid. Wires `meshStatus`, `setCurrentTab` as `onNavigate`, `handleRunPipeline` as `onRunAudit`, and `handleStartEcosystem` as `onStartServices`.

### v2.5.0 — Autonomous On-Demand Service Dispatch & Non-Destructive Card Controls

- **`src/api/client.ts` — Daemon Lifecycle Endpoints** — Added `startService(serviceId)`, `stopService(serviceId)`, and `startAllServices()` connecting directly to Environment Manager daemon process endpoints on port 8000.
- **`src/components/ServiceTiles.tsx` — Independent Start Service Buttons** — Replaced generic clean install redirection with dedicated `onStartService(serviceId)` actions. Button displays live `Starting Service...` state and prevents accidental multi-triggering while daemons bind to their ports.
- **`src/App.tsx` — Non-Destructive Service Dispatch** — Replaced `handleStartEcosystem` with `handleStartService` and `handleStartAllServices`. Clicking `Start Service` on any offline card now cleanly spawns that specific process in the background without modifying or wiping existing project virtual environments or running the clean install pipeline.

### v2.6.0 — Automated Sidecar Startup on Launch & Real-Time Mesh Telemetry

- **`src/App.tsx` — Automated Startup Routine on Launch** — Added `autoStartOffline` startup effect on initial GUI mount. Automatically probes the tripartite mesh and triggers background daemon launch for any offline sidecar without manual intervention.
- **`src/App.tsx` — Decoupled Fast Mesh Polling & Continuous Heartbeat** — Extracted `refreshMeshStatus()` to immediately update UI service tiles (<90ms) independently of slow full-ecosystem audits (~9s). Added a 4-second reactive background polling loop keeping sidecar status badges continuously synchronized.
- **`src/api/client.ts` — GET-Based Health Fallback** — Standardized `probeSidecarPort()` to use standard `GET` requests with `res.ok` validation, ensuring universal compatibility across FastAPI routers.
