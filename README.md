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
  - Deconstructed into dedicated micro-tabs:
    - **Manifest Editor Tab (`ManifestEditorTab.tsx`)**: In-app syntax checking, schema validation, visual diff preview, and atomic backup writing.
    - **Secrets Vault Tab (`SecretsEditorTab.tsx`)**: Multi-service credential manager supporting Kaggle (mandatory), Google Drive, GitHub, Hugging Face, MetaTrader 5, Saturn Cloud, Weights & Biases, and custom API tokens.

- **Centralized State Architecture (Zustand `useStudioStore`)**:
  - Unified reactive state store (`src/store/useStudioStore.ts`) eliminating redundant network round-trips and component prop drilling.
  - Manages tripartite sidecar health monitoring (Ports 8000, 8100, 8200), hardware accelerator metrics, running local/cloud training jobs, model and dataset cache manifolds, and real-time ANSI telemetry buffers.

- **5-Panel Streamlined Navigation Topology**:
  - **Dashboard**: Hardware Acceleration Sentinel, Tripartite Sidecar Tiles, Managed Workspace Projects Health, and embedded event diagnostics.
  - **Dataset Compiler**: Standard presets, Direct Kaggle Ingestion, verified production manifolds with card-level Kaggle sync, and embedded telemetry console.
  - **Model Training**: Architecture matrix, Sawtooth Governor VRAM safeguards, spatial ladders, and 3-tab live telemetry console.
  - **Clean Install Pipeline**: Autonomous 7-stage deterministic environment provisioning and toolchain verification.
  - **Health & Version Drift**: Toolchain prerequisites, Cross-Project Python Drift Matrix, Desktop GUI Project Packages (NPM) audit, and ecosystem maintenance actions.

- **Modular S.O.L.I.D. Component Hierarchy**:
  - **Shared Micro-Components**:
    - **`ValidationBanner.tsx`**: Unified notification banner with auto-type deduction (`info`, `success`, `warning`, `error`), dismiss buttons, and accessible ARIA alert/status semantics.
    - **`HoverPinPopover.tsx`**: Zero-dependency CSS hover and native semantic `<button>` pin popover for SOTA targets and upstream raw sources, strictly adhering to `jsx-a11y` standards.
    - **`HelpTooltip.tsx`**: Contextual interactive hover guidance popovers attached to interactive controls across all panels.
  - **Training Subsystem**:
    - `ModelManifoldCard.tsx`: Dedicated card handling spatial ladder progress, multi-variation isolation badges, SOTA target metrics, primary local/cloud training triggers, export actions, and in-app model card documentation regeneration (`Docs & Meta`).
    - `TelemetryConsole.tsx`: High-throughput 3-tab terminal displaying live Local Training, Remote Cloud, and Ecosystem Mesh logs with ANSI stripping, auto-scroll, regex search, zero-loss clipboard export (with secure `navigator.clipboard` and legacy `execCommand` fallback), and sub-second minibatch abort.
    - `TrainingToolbar.tsx`: Fleet-wide batch action triggers ("Unit Test All Models", "Generate All Notebooks", "Push All Models to Kaggle", "Refresh Models"), live search filter, and category/architecture selectors.
    - `VariationIsolationChecker.tsx`: Interactive verification checklist for isolated Kaggle Model Hub variations (PyTorch, ONNX FP32, ONNX FP16) with dry-run protection.
  - **Compiler Subsystem**:
    - `DatasetManifoldCard.tsx`: Manifold statistics, container format badges, sample counts, upstream source popovers, and direct card-level Kaggle actions (`Update Metadata`, `Download from Kaggle`, `Upload to Kaggle`).
    - `DatasetCompilationForm.tsx`: Standard presets and Direct Kaggle Ingestion engines with WebDataset container streaming and WebP transcoding.
    - `ModernizationQueueTable.tsx`: Background queue orchestrator with worker thread concurrency controls.
    - `ScaleReductionView.tsx`: Image downscaling governor for bandwidth-constrained remote environments.
    - `CompilerToolbar.tsx`: Format filters, global dataset action buttons, and live archiving/upload/extraction telemetry progress indicators.

- **Dataset Compiler & Modernization Suite**:
  - **Standard Compilation Presets**: Fast transformation of raw archives into WebDataset `.data` / `.tar` shards, Parquet, MosaicML `.mds`, or LitData containers.
  - **Direct Kaggle Ingestion**: Direct cloud ingestion pulling remote research datasets directly from Kaggle URLs or slugs straight into streaming WebDataset shards.
  - **Card-Level Kaggle Cloud Synchronization**: Download, upload, and update metadata directly per dataset from individual manifold cards, with global batch metadata sync from the top toolbar.
  - **Production Manifolds Catalog**: Real-time status, format breakdowns, sample counts, and disk metrics across all 20 production manifolds.

- **Multi-Variation Kaggle Model Hub & Cloud Training**:
  - Interactive cloud training dialog supporting Kaggle Dual-T4 and P100 hardware clusters.
  - Fleet-Wide Kaggle Push: One-click "Push All Models to Kaggle" toolbar action to stage, validate, and publish all 22 registered neural architectures and their multi-format variations with pre-flight isolation verification.
  - Automated staging and verification of 3 distinct isolated variations:
    - Variation 1 (`pytorch`): PyTorch checkpoint binaries (`*.pt`).
    - Variation 2 (`onnx_fp32`): High-precision standard ONNX exports (`*_FP32.onnx*`).
    - Variation 3 (`onnx_fp16`): Edge-optimized half-precision ONNX exports (`*.onnx`).
  - Pre-upload isolation checks and model documentation regeneration (`ModelDocumentationService`).

- **Contextual UX Help & Interactive Hover Guidance**:
  - Every interactive UI element features an inline help icon badge (`?`).
  - Hovering over any help icon displays an elevated glassmorphic tooltip card explaining the control's function, associated CLI/API command, and operational side effects.

- **Permanent Offline Documentation Hub**:
  - Embedded local documentation server permanently available at `http://localhost:1420/documentation-hub/index.html` (and mirrored at `http://127.0.0.1:8000/documentation-hub/index.html`).
  - Provides full offline access to all 46 scientific whitepapers, manuals, and architectural specifications with zero external internet dependencies.

- **Embedded Real-Time Telemetry & Diagnostics**:
  - 3-tab live console (Local Training, Remote Cloud, Ecosystem Mesh) embedded directly on individual operational panels.
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

### v2.10.0 — Modernization Queue Subtabs, Scale Reduction, Fleet Diagnostics & Ecosystem Governance Cards

- **`src/components/CompilerPanel.tsx` — Modernization Queue & Scale Reduction Subtabs** — Structured Section 2 into three sub-tabs: "Manifolds Catalog" (21 production manifolds), "Modernization Queue & Transcode" (interactive scan of datasets needing WebP transcoding, worker pool slider, push to Kaggle, dry-run, force flags, and batch execution), and "Scale Reduction (Downsample)" (downsampled dataset derivation with 10%, 25%, 50%, 75% scale presets). Added top toolbar buttons: "Update All Kaggle Metadata" (bulk Kaggle push) and "Regenerate Manifolds Index".
- **`src/components/TrainingPanel.tsx` — Fleet Diagnostics, Batch Notebooks & Card Actions** — Added global toolbar buttons: "Run 1-Epoch Diagnostic (All 22 Models)" (`POST /api/training/unit-test-all`) and "Generate All Notebooks" (`POST /api/notebooks/generate-all`). Added per-model action buttons: "Evaluate Model" (`POST /api/training/evaluate`) and "Export Binaries" (`POST /api/training/export`).
- **`src/components/CloudTrainModal.tsx` — Checkpoint Upload to Kaggle Models** — Added third cloud option tab "Upload Checkpoints" allowing operators to stage and publish trained model weights directly to Kaggle Models repositories with live status reporting.
- **`src/components/HealthPanel.tsx` — Ecosystem Maintenance & Governance Card** — Added dedicated governance control card providing one-click buttons for "Safe Package Upgrade", "Upgrade Dry Run", "Deep Cache Purge" (`POST /api/clean`), "Install Git Hooks" (`POST /api/hooks/install`), and "Run Ecosystem Validation" (`POST /api/validate`).
- **`src/api/client.ts` & `src/api/types.ts` — API Interface Expansion** — Added full TypeScript interfaces and asynchronous wrapper functions for all new sidecar capabilities across ports 8000, 8100, and 8200.

### v2.8.6 — Telemetry Control Sequence Sanitation & Tag Flex Hardening

- **`src/api/client.ts` — ANSI Sequence Cleanser Precision (`cleanAnsiAndControlChars`)** — Hardened regex replacement to require at least one numerical digit/parameter (`^\[[0-9;]+[a-zA-Z]`) when stripping remnant ANSI CSI sequences. Prevented zero-length match corruption that erroneously stripped the leading bracket and character from logging tags like `[PROGRESS]` and `[GOVERNOR]`.
- **`src/components/LogPanel.tsx` & `src/index.css` — Log Tag Squeeze Prevention** — Applied `flex-shrink: 0` and `white-space: nowrap` to `.log-tag-*` indicators within `.log-line` flex layouts, ensuring step and system indicators (`[SYS] [TRAINING]:`) remain unclipped across long monospace telemetry payloads.

### v2.8.5 — Telemetry Stream Positioning & Sub-Second Training Cancellation UI

- **`src/components/TrainingPanel.tsx` — Direct Telemetry Stream Slot (`logSlot`)** — Moved the live `Real-time Telemetry & Pipeline Stream` panel directly above the `Registered Architectures & Checkpoint Telemetry` models list via an injected `logSlot` component prop. Operators no longer need to scroll past 20 model cards to monitor streaming training logs.
- **`src/App.tsx` — Unified Training Tab Layout** — Replaced the bottom-anchored log panel with inline injection into `TrainingPanel`, delivering a cohesive top-down workflow: Training Controls -> Live Telemetry Stream -> Registered Architecture Cards.
- **`src/components/TrainingPanel.tsx` — Responsive Job Cancellation Handshake** — Connected the `Stop Training` action button to instant minibatch-level cancellation on the sidecar daemon. Polling automatically syncs job status when cancellation completes, reverting the button to `Start Training`.

### v2.8.0 — SSOT Config-Governed Readonly Parameters & Dynamic Start/Stop Action Toggle

- **`src/components/TrainingPanel.tsx` — Single Source of Truth (SSOT) Parameter Locking** — Locked `Training Epochs`, `Minibatch Size`, `Initial Learning Rate`, and `Spatial Ladder Stage` / `Timeframe Confluence Stage` into read-only controls (`.editor-input-readonly`) for all models. Parameters are strictly governed by canonical manifests (`unified_models_v2.yaml` / `presets.yaml`). Added the prominent `.config-governed-banner` with direct shortcut navigation to the Config Editor Modal (`onOpenConfigEditor`).
- **`src/components/TrainingPanel.tsx` — Dynamic Start/Stop Action Toggle** — Replaced static one-way dispatch button with a reactive run-state toggle. Automatically polls `fetchRunningTrainingJobs()` (`GET /api/jobs?status=running`) every 3 seconds. While a training job is actively executing, the button switches to `Stop Training` with high-visibility `.btn-danger` styling and routes to `cancelTrainingJob(runningJobId)` (`POST /api/jobs/{job_id}/cancel`). Reverts to `Start Training` (`.btn-primary`) when idle or completed.
- **`src/App.tsx` — Config Editor Modal Wiring** — Passed `onOpenConfigEditor={() => setIsConfigEditorOpen(true)}` to `TrainingPanel`, providing seamless in-app access to view and adjust authoritative model manifests.
- **`src/index.css` — Readonly Controls & Action Button Styling** — Added `.btn-danger` gradient and focus states (`#ef4444` to `#dc2626`), `.editor-input-readonly` background and border styling, and `.config-governed-banner` responsive layout.

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

### v2.7.0 — Dataset Compiler Card 2x2 Action Button Hierarchy & Color Synchronization

- **`src/components/CompilerPanel.tsx` — 2x2 Button Grid Harmonization** — Synchronized Dataset Card action button styling and visual hierarchy with the Model Card toolbar (`TrainingPanel.tsx`):
  - **Top-Left (`Update Metadata`)**: Upgraded to `btn btn-primary` (Cyan-Blue solid gradient, matching `Local Training`).
  - **Top-Right (`Audit Notebooks`)**: Upgraded to `btn btn-cloud` (Purple solid gradient, matching `Cloud Training`).
  - **Bottom-Left (`Download`)**: Standardized to `btn btn-vault-pull` (Dark vault outline button with download icon).
  - **Bottom-Right (`Upload`)**: Corrected to `btn btn-vault-push` (Dark vault outline button with upload icon, replacing erroneous `btn-vault-pull`).
- **Ecosystem UI Consistency** — Enforced 100% visual parity across all card components: top row reserved for solid primary/cloud trigger buttons and bottom row for dark vault operations.

### v2.8.0 — Full-Mesh Autonomous Cold Boot & Dev Middleware Service Dispatch

- **`vite.config.ts` — Vite Dev Middleware Service Launcher** — Added `/api/dev/services/start-all` and `/api/dev/services/start` middleware to the Vite dev server. When all services (or Port 8000) are offline during development, Vite's Node.js engine automatically detects virtual environment Python paths, spawns `uvicorn` daemons with `detached: true` and windowless execution, probes readiness via non-blocking TCP socket verification, and cascades orchestration across all three tripartite sidecars.
- **`src-tauri/src/commands.rs` — Tauri Sidecar Virtualenv Resolution** — Updated `spawn_sidecar` to resolve `.venv/Scripts/pythonw.exe` inside `lemgendary-env-manager`, bind the process working directory directly to `../lemgendary-env-manager`, and enforce Windows `CREATE_NO_WINDOW` (0x08000000) flags.
- **`src/api/client.ts` — Transparent Dev Endpoints & Seamless Fallback** — Added `startDevService` and `startDevAllServices`. `startService` and `startAllServices` automatically fall back to the Vite dev endpoints whenever Port 8000 is down.
- **`src/App.tsx` — Direct One-Click Cold Boot** — `handleStartAllServices` now starts the complete tripartite mesh directly from cold offline state without displaying terminal execution warning banners or requiring manual shell commands. Individual `handleStartService` calls for Environment Manager cleanly boot the orchestrator.

### v2.9.0 — Universal Cross-Platform Windowless Daemon Dispatch

- **Zero Terminal / Shell Window Spawning** — Eliminated all invocation of Windows Command Prompt (`cmd.exe`) and PowerShell (`powershell.exe`). Daemons are executed directly via windowless binary dispatch (`pythonw.exe` with `CREATE_NO_WINDOW` (0x08000000) on Windows, and `.venv/bin/python` with detached sessions on POSIX/Linux/macOS/mobile).
- **Independent Single Service Controls** — Each "Start Service" button on the ecosystem cards targets and launches strictly its corresponding single service without starting unwanted sidecars or re-running global setup pipelines.
- **Unified Tauri Native & Dev Bridge** — Integrated `spawn_service` and `spawn_all_services` directly into `src/api/client.ts` with standard `Stdio::null()` redirection and resilient directory discovery across desktop environments.
- **Clean Error Handling & Telemetry** — Removed shell-specific remediation copy buttons from error banners, providing unified cross-platform diagnostics across Windows, Linux, macOS, Unix, and mobile architectures.

### v3.0.0 — Modern Telemetry Progress Architecture & Stream Governance

- **Accessible Radix UI Progress Engine** — Integrated `@radix-ui/react-progress` installed and managed via `lemgendary-env-manager`, providing 100% WAI-ARIA accessible (`role="progressbar"`), zero-runtime overhead progress bars with hardware-accelerated CSS animations.
- **Two-Line Progress Architecture** — Enforced universal two-line progress tracking across all components:
  - **Line 1 (Unconstrained Operational Metrics)**: Operation title, target name, percentage, transfer size / epoch count, transfer rate, and ETA cleanly spaced without text clipping or truncation.
  - **Line 2 (Visual Progress Bar Only)**: Full-width glowing gradient progress bar with cyber-cyan / emerald theme and dynamic pulse indicators.
- **Clean Telemetry Output & Zero-Clutter Stream De-duplication** — Consecutive progress tick updates for active operations are rolled up in-place, preventing terminal scrolling flood while preserving discrete step start, milestone, artifact generation, and completion logs.
- **Multi-Subsystem Stream Isolation** — Strictly segregated Dataset Compiler (`[Compiler]`), Local GPU Training (`[Local]`), and Remote Cloud Training (`[Cloud]`) streams across dedicated panels.
- **Zero Warnings Root Cause Enforcement** — Resolved PyTorch non-writable tensor warning in `forex_dataset.py` by implementing `_safe_from_numpy(arr)` with buffer writeability checks, strictly prohibiting warning suppression or silencing.
