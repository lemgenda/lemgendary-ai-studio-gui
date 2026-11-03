# LemGendary AI Studio GUI: Lead Architect Review Report

Review phase only. No source, configuration, or existing documentation was
modified. All paths are relative to `./lemgendary-ai-studio-gui/` unless they
start with `../` (sibling repositories in the workspace).

Governance baseline: `../ROBOTS.md` (supreme) and `../Instructions.md`.
Required reading consulted:
`../lemgendary-docs/MD-Papers/PAPER_AI_STUDIO_GUI.md`,
`../lemgendary-docs/MD-Papers/MANUAL_AI_STUDIO_GUI.md`,
`../lemgendary-docs/MD-Papers/GUI_CONTROL_REGISTRY.md`, and
`../bug_report_implementation_plan.md`.

Confidence markers used below: **[verified]** = reproduced by reading code or
running a tool; **[high]** = strong static evidence, not executed;
**[uncertain]** = plausible, needs runtime confirmation.

## Tool Results

- Install
  - **Command**: `npm install --no-audit --no-fund`
  - **Result**: Exit 0, 368 packages. Warnings: deprecated `eslint@8.57.1`,
    `glob@7`, `rimraf@3`, `inflight`; `esbuild` postinstall not covered by
    `allowScripts`.
- Typecheck
  - **Command**: `npm run typecheck`
  - **Result**: Exit 0 (covers `src/` only).
- Lint
  - **Command**: `npm run lint`
  - **Result**: Exit 0, zero warnings (`--max-warnings 0`).
- Test
  - **Command**: `npm test`
  - **Result**: Exit 0, 8 files, 42/42 tests passed.
- Extra
  - **Command**: `npx tsc -p tsconfig.node.json --noEmit`
  - **Result**: **30 type errors** in `vite.config.ts` (no `@types/node`, no
    `lib`/`target`). This file is never typechecked by any script.
- Rust
  - **Command**: `cargo`
  - **Result**: Not installed; `src-tauri/` reviewed statically only.

Repository side effects: `node_modules/` and `package-lock.json` are both
listed in `.gitignore` and `package-lock.json` was absent before install, so
`git status` stays clean. The extra `tsc -p tsconfig.node.json` run emitted an
untracked `tsconfig.node.tsbuildinfo` (composite project); it was deleted
immediately and `git status --short` is empty again.

## Executive Findings

### Strengths

- Clean gates: strict TypeScript, `jsx-a11y/strict`, zero inline suppressions
  (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `#[allow]` all absent
  from `src/`, `src-tauri/`, `vite.config.ts`) **[verified]**.
- A real mesh SSOT exists for URLs: `src/api/config.ts:42-67` with `VITE_*`
  overrides and `toWebSocketUrl()`.
- Telemetry normalization is origin-tagged (`src/api/client.ts:1165-1248`),
  making stream filtering port-agnostic.
- Zustand store uses selectors in most places (`src/App.tsx:44-59`).
- Good baseline accessibility: skip link, `role="log"`, `aria-busy`,
  `prefers-reduced-motion`, `:focus-visible` (`src/index.css:40-110`).
- API contracts are largely correct: every GUI-consumed route exists in the
  sidecar route code (see Cross-Project Findings).

### Weaknesses

- Monoliths: `src/api/client.ts` (1335 lines), `src/index.css` (1298),
  `src/components/training/ModelManifoldCard.tsx` (700),
  `src/components/TrainingPanel.tsx` (673), `src/components/CompilerPanel.tsx`
  (622, 40+ `useState`), `src/App.tsx` (614).
- Interface bloat: `DatasetCompilationForm` takes 43 props; `ModelManifoldCard`
  takes 14 callbacks.
- 579 inline `style={{ }}` objects across components; 15 `!important` rules.
- 36 bare `catch {}` blocks outside tests, many converting failures into empty
  arrays or `false`.
- Four parallel static inventories duplicate sidecar registries
  (`fallbackModels.ts`, `fallbackDatasets.ts`, `FALLBACK_PROJECTS`, fallback
  manifest list).

### Risks

- **Secrets exposure**: plaintext tokens are served unauthenticated with CORS
  `*` by the Environment Manager and consumed by the GUI; Tauri CSP is
  disabled (`src-tauri/tauri.conf.json:24`).
- **Packaged build is not production-ready**: missing bundle icons, missing
  capabilities, and three features that only work through Vite dev
  middleware.
- **Documentation trust**: 55 of 78 registry control IDs do not exist in code;
  manual and paper describe a "Run Tests" button removed in README v2.10.7.

### Opportunities

- Generate `src/api/types.ts` from regenerated sidecar `openapi.json` files.
- Introduce a single `Modal` primitive and a view registry; both unblock the
  Report Issue feature cleanly.
- Move model status heuristics into the Training Suite (single owner).

## Architecture Findings

### Current Architecture

```text
main.tsx
  App.tsx  (mesh polling, WS fan-in, pipeline lifecycle, service lifecycle,
            auto-start, banners, tab routing, 2 modals)  <- God component
    Sidebar / Header / StatusBar
    Dashboard: ServiceTiles, HardwareCard, PipelinePanel, ProjectCard[], LogPanel
    Datasets:  CompilerPanel -> DatasetCompilationForm, CompilerToolbar,
               DatasetManifoldCard[], ModernizationQueueTable, ScaleReductionView
    Training:  TrainingPanel -> TrainingToolbar, ModelManifoldCard[],
               TelemetryConsole, CloudTrainModal -> VariationIsolationChecker
    Pipeline:  PipelinePanel, PipelineStepCards, LogPanel
    Health:    HealthPanel, LogPanel
    ConfigEditorModal -> ManifestEditorTab, SecretsEditorTab
    TestModal (mounted, never openable)
store/useStudioStore.ts  (single Zustand store, partially dead fields)
api/config.ts (mesh SSOT) + api/client.ts (HTTP, Tauri IPC, WS, ANSI, progress,
              model heuristics, lifecycle fallbacks) + api/types.ts (hand-written)
vite.config.ts (dev-only API: service spawn, model telemetry CSV, docs server)
src-tauri: 4 commands, shell plugin with no capability, csp null
```

Assessment:

- **SRP**: `App.tsx` owns at least seven responsibilities; `client.ts` mixes
  transport, platform detection, process lifecycle, telemetry parsing, and
  domain heuristics.
- **OCP**: adding a view requires edits in `Sidebar.tsx:27-33`,
  `App.tsx:367-382`, `App.tsx:474-588`, `useStudioStore.ts:69`; adding a
  sidecar requires edits in `config.ts`, `vite.config.ts:46-65`,
  `src-tauri/src/commands.rs:31-36`, `App.tsx:304-306`, `App.tsx:329-331`,
  `normalizeSocketMessage` branches.
- **LSP / type sniffing**: `isTauri` sniffing duplicated
  (`client.ts:212-214`, `client.ts:255-257`); project kind sniffed by
  `name.includes("gui")` (`ProjectCard.tsx:40-54`); model kind sniffed by key
  literals (`client.ts:677-678`).
- **DIP**: components import concrete fetch functions directly; there is no
  service abstraction to mock or swap (tests mock `fetch` globally).
- **State**: store fields `notification`, `setNotification`, `addEvent` are
  never used (`useStudioStore.ts:46`, `useStudioStore.ts:59-60`); progress
  roll-up logic is duplicated in `App.tsx:146-158` and
  `useStudioStore.ts:120-134`.

### Proposed Architecture

```text
src/
  app/
    AppShell.tsx            layout only
    viewRegistry.ts         SSOT: id, label, title, tooltip, sidecar, component
    useMeshStatus.ts        4 s poll, single source for meshStatus
    useTelemetryStream.ts   WS mesh -> store.addEvent (one roll-up impl)
    usePipelineRunner.ts    run, run-step, terminal detection, safety poll
    useServiceLifecycle.ts  start/stop/startAll + waitForReachable()
    modalStore.ts           activeModal union + ?modal= deep link
  api/
    http.ts                 request<T>(): base URL, timeout, AbortSignal,
                            error-body parsing, typed ApiError
    envManager.ts | datasetCompiler.ts | trainingSuite.ts | kaggle.ts
    generated/*.ts          openapi-typescript output (replaces types.ts)
    lifecycle/              ServiceLauncher interface:
                            TauriLauncher | EnvManagerLauncher | DevLauncher
  telemetry/
    normalizers.ts          Record<ServiceId, Normalizer> (OCP)
    progress.ts             isProgressLine, rollup, cleanAnsi
    socketMesh.ts
  components/common/        Modal, Tabs, Banner, Field, HelpTooltip
  features/<view>/          panel + hooks + subcomponents per view
  styles/                   tokens.css, base.css, a11y.css, per-feature CSS
```

Platform rule: anything that needs the file system or process control goes
through Tauri commands in production and through the Environment Manager
otherwise; the Vite dev server must not be an application backend.

## GUI Inventory

Columns: component, control (DOM `id` or `none`), handler, endpoint.
`{key}` is the dataset or model key; ports are the defaults from
`src/api/config.ts`.

### Shell (all views)

- `App.tsx:386`
  - **Control (id)**: Skip link (none)
  - **Handler**: anchor `#main-content`
  - **Endpoint**: none
- `Sidebar.tsx:81`
  - **Control (id)**: Tab buttons (`tab-dashboard`, `tab-datasets`,
    `tab-training`, `tab-pipeline`, `tab-health`)
  - **Handler**: `onSelectTab` -> `setCurrentTab`
  - **Endpoint**: none
- `Sidebar.tsx:109`
  - **Control (id)**: Brand footer link (none)
  - **Handler**: anchor `_blank`
  - **Endpoint**: external site
- `Header.tsx:34`
  - **Control (id)**: Config and Secrets (none)
  - **Handler**: `onOpenConfigEditor`
  - **Endpoint**: opens ConfigEditorModal
- `Header.tsx:47`
  - **Control (id)**: Documentation Hub (none)
  - **Handler**: `handleOpenDocs` -> `window.open`
  - **Endpoint**: `/documentation-hub/index.html` (Vite dev only)
- `Header.tsx:59`
  - **Control (id)**: Refresh Audit (`dash-btn-refresh-audit`)
  - **Handler**: `loadData`
  - **Endpoint**: `GET /api/hardware`, `GET /api/health`, `GET
    /api/pipeline/status`, `GET /api/gui/ecosystem` (8000)
- `App.tsx:430`
  - **Control (id)**: Start All Services (none)
  - **Handler**: `handleStartAllServices`
  - **Endpoint**: Tauri `spawn_all_services`, else `POST
    /api/services/start-all` (8000), else `POST /api/dev/services/start-all`
    (Vite)
- `App.tsx:461`
  - **Control (id)**: Dismiss error (none)
  - **Handler**: `setRefreshError(null)`
  - **Endpoint**: none
- `StatusBar.tsx:27`
  - **Control (id)**: Mesh status (none)
  - **Handler**: display
  - **Endpoint**: none
- `HelpTooltip.tsx:18`
  - **Control (id)**: Help glyph, about 120 instances (none)
  - **Handler**: hover/focus
  - **Endpoint**: none

### Dashboard

- `ServiceTiles.tsx:102`
  - **Control (id)**: Quick action per service (none)
  - **Handler**: `onRunAudit` or `onNavigate`
  - **Endpoint**: `POST /api/pipeline/run` (8000) for env card
- `ServiceTiles.tsx:115`
  - **Control (id)**: Start Service (none)
  - **Handler**: `handleStartService(id)`
  - **Endpoint**: Tauri `spawn_service` or `POST /api/services/{id}/start`
    (8000)
- `ServiceTiles.tsx:126`
  - **Control (id)**: Stop Service (none)
  - **Handler**: `handleStopService(id)`
  - **Endpoint**: `POST /api/services/{id}/stop` (8000)
- `HardwareCard.tsx:25`
  - **Control (id)**: Start Environment Manager (none)
  - **Handler**: `handleStartService("env-manager")`
  - **Endpoint**: as above
- `PipelinePanel.tsx:92`
  - **Control (id)**: Execute Full Clean Install Pipeline
    (`dash-btn-run-pipeline`)
  - **Handler**: `handleRunPipeline`
  - **Endpoint**: `POST /api/pipeline/run` (8000)
- `ProjectCard.tsx:75`
  - **Control (id)**: Reconcile Environment (none)
  - **Handler**: `handleReconcileProject(name)`
  - **Endpoint**: `POST /api/pipeline/run` with `target_project` (8000)
- `LogPanel.tsx:93`
  - **Control (id)**: Copy Stream (none)
  - **Handler**: `handleCopy`
  - **Endpoint**: clipboard
- `LogPanel.tsx:105`
  - **Control (id)**: Clear Stream (none)
  - **Handler**: `onClear`
  - **Endpoint**: none
- `LogPanel.tsx:120`
  - **Control (id)**: Log region (none)
  - **Handler**: display
  - **Endpoint**: WS `/ws/log` (8000), `/api/ws/events` (8100), `/api/ws/logs`
    (8200)

### Dataset Compiler

- `DatasetCompilationForm.tsx:119`
  - **Control (id)**: Kaggle ref input (none, unlabelled)
  - **Handler**: `setCustomKaggleRef`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:129`
  - **Control (id)**: Target folder input (none, unlabelled)
  - **Handler**: `setDownloadTargetFolder`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:150`
  - **Control (id)**: Force Re-download checkbox (none)
  - **Handler**: `setDownloadForce`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:159`
  - **Control (id)**: Ingest from Kaggle (none)
  - **Handler**: `handleCustomKaggleDownload`
  - **Endpoint**: `POST /api/kaggle/download` (8100)
- `DatasetCompilationForm.tsx:189`
  - **Control (id)**: Standard mode (none)
  - **Handler**: `setCompileMode("standard")`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:197`
  - **Control (id)**: Custom mode (none)
  - **Handler**: `setCompileMode("custom")`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:234`
  - **Control (id)**: Manifold select (`comp-select-manifold`)
  - **Handler**: `setSelectedManifold`
  - **Endpoint**: data from `GET /api/gui/datasets/with-stats`
- `DatasetCompilationForm.tsx:264`
  - **Control (id)**: Preset select (`preset-select`)
  - **Handler**: `setSelectedPreset`
  - **Endpoint**: data from `GET /api/gui/presets`
- `DatasetCompilationForm.tsx:294`
  - **Control (id)**: Shard size (`shard-size-input`)
  - **Handler**: `setShardSize`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:311`
  - **Control (id)**: Purge loose images (`purge-loose-check`)
  - **Handler**: `setPurgeLooseImages`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:329`
  - **Control (id)**: Compile Manifold (`comp-btn-compile`)
  - **Handler**: `handleCompile`
  - **Endpoint**: `POST /api/gui/quick-compile` (8100)
- `DatasetCompilationForm.tsx:382`
  - **Control (id)**: Custom name (`custom-name-input`)
  - **Handler**: `setCustomName`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:408`
  - **Control (id)**: Custom task (`custom-task-select`)
  - **Handler**: `setCustomTask`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:438`
  - **Control (id)**: Container format (`custom-format-select`)
  - **Handler**: `setCustomCanonicalFormat`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:471`
  - **Control (id)**: Custom preset (`custom-preset-select`)
  - **Handler**: `setCustomPreset`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:501`
  - **Control (id)**: Custom shard size (`custom-shard-size`)
  - **Handler**: `setCustomShardSize`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:518`
  - **Control (id)**: Custom purge (`custom-purge-check`)
  - **Handler**: `setCustomPurgeLoose`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:558`
  - **Control (id)**: Sources textarea (`custom-sources-area`)
  - **Handler**: `setCustomSourcesText`
  - **Endpoint**: none
- `DatasetCompilationForm.tsx:573`
  - **Control (id)**: Compile Custom Dataset (none)
  - **Handler**: `handleCustomCompile`
  - **Endpoint**: `POST /api/gui/custom-compile` (8100)
- `CompilerToolbar.tsx:88`
  - **Control (id)**: Catalog / Modernization / Scale Reduction segments (none)
  - **Handler**: `setActiveSectionTab`
  - **Endpoint**: none
- `CompilerToolbar.tsx:117`
  - **Control (id)**: Update All Kaggle Metadata (`comp-btn-update-all-kaggle`)
  - **Handler**: `handleUpdateAllMetadata`
  - **Endpoint**: `POST /api/kaggle/update-metadata` (8100)
- `CompilerToolbar.tsx:129`
  - **Control (id)**: Regen Index (`comp-btn-regen-manifolds`)
  - **Handler**: `handleRegenerateManifolds`
  - **Endpoint**: `POST /api/modernize/regenerate-manifolds` (8100)
- `CompilerToolbar.tsx:141`
  - **Control (id)**: Refresh Catalog (`comp-btn-refresh-catalog`)
  - **Handler**: `loadCompilerData`
  - **Endpoint**: `GET /api/gui/datasets/with-stats`, `GET /api/gui/presets`
    (8100)
- `CompilerToolbar.tsx:172`
  - **Control (id)**: Search input (none, unlabelled)
  - **Handler**: `setSearchQuery`
  - **Endpoint**: none
- `CompilerToolbar.tsx:181`
  - **Control (id)**: Clear search "X" (none, no accessible name)
  - **Handler**: `onSearchChange("")`
  - **Endpoint**: none
- `CompilerToolbar.tsx:206`
  - **Control (id)**: Status, format, task filters (none, unlabelled)
  - **Handler**: filter setters
  - **Endpoint**: none
- `CompilerToolbar.tsx:259`
  - **Control (id)**: Reset filters (none)
  - **Handler**: `onResetFilters`
  - **Endpoint**: none
- `DatasetManifoldCard.tsx:115`
  - **Control (id)**: Upstream sources popover (none)
  - **Handler**: `toggleSourcesPin`
  - **Endpoint**: none
- `DatasetManifoldCard.tsx:200`
  - **Control (id)**: Update Metadata (`comp-btn-meta-{key}`)
  - **Handler**: `handleUpdateMetadataSingle`
  - **Endpoint**: `POST /api/kaggle/update-metadata` (8100)
- `DatasetManifoldCard.tsx:227`
  - **Control (id)**: Audit Notebooks link (none)
  - **Handler**: anchor `_blank`
  - **Endpoint**: hardcoded Kaggle URL
- `DatasetManifoldCard.tsx:264`
  - **Control (id)**: Download (`comp-btn-pull-{key}`)
  - **Handler**: `handleDownloadManifold`
  - **Endpoint**: `POST /api/kaggle/download` (8100)
- `DatasetManifoldCard.tsx:292`
  - **Control (id)**: Upload (`comp-btn-push-{key}`)
  - **Handler**: `handleUploadManifold`
  - **Endpoint**: `POST /api/kaggle/upload` (8100)
- `ModernizationQueueTable.tsx:55`
  - **Control (id)**: Workers, Push Kaggle, Force, Dry Run (none)
  - **Handler**: state setters
  - **Endpoint**: none
- `ModernizationQueueTable.tsx:93`
  - **Control (id)**: Scan Queue (none)
  - **Handler**: `loadModernizationQueue`
  - **Endpoint**: `GET /api/modernize/queue` (8100)
- `ModernizationQueueTable.tsx:103`
  - **Control (id)**: Batch Modernize All (none)
  - **Handler**: `handleRunModernize()`
  - **Endpoint**: `POST /api/modernize/run` (8100)
- `ModernizationQueueTable.tsx:173`
  - **Control (id)**: Per-row modernize (none)
  - **Handler**: `handleRunModernize(key)`
  - **Endpoint**: `POST /api/modernize/run` (8100)
- `ScaleReductionView.tsx:42`
  - **Control (id)**: Manifold (`reduce-manifold-select`)
  - **Handler**: `setReduceManifold`
  - **Endpoint**: none
- `ScaleReductionView.tsx:63`
  - **Control (id)**: Scale (`reduce-scale-select`)
  - **Handler**: `setReduceScale`
  - **Endpoint**: none
- `ScaleReductionView.tsx:79`
  - **Control (id)**: Launch Scale Reduction (none)
  - **Handler**: `handleRunReduce`
  - **Endpoint**: `POST /api/modernize/reduce` (8100)

### Model Training Suite

- `TrainingToolbar.tsx:75`
  - **Control (id)**: Generate All Notebooks
    (`train-btn-generate-all-notebooks`)
  - **Handler**: `handleGenerateAllNotebooks`
  - **Endpoint**: `POST /api/notebooks/generate-all` (8200)
- `TrainingToolbar.tsx:87`
  - **Control (id)**: Push All Models (`training-toolbar-push-all-models-btn`)
  - **Handler**: `handlePushAllKaggle`
  - **Endpoint**: `POST /api/training/kaggle/push-all` (8200)
- `TrainingToolbar.tsx:99`
  - **Control (id)**: Refresh Models (`train-btn-refresh-models`)
  - **Handler**: `loadTrainingData`
  - **Endpoint**: `GET /api/gui/models/with-stats` (8200) plus N x
    `/api/model-telemetry/{key}` (Vite)
- `TrainingToolbar.tsx:129`
  - **Control (id)**: Search, clear, status, category, architecture filters,
    reset (none)
  - **Handler**: filter setters
  - **Endpoint**: none
- `ModelManifoldCard.tsx:216`
  - **Control (id)**: SOTA target popover (none)
  - **Handler**: `onToggleTargetPin`
  - **Endpoint**: none
- `ModelManifoldCard.tsx:367`
  - **Control (id)**: Batch size select (none, aria-label)
  - **Handler**: `setSelectedBatchSize`
  - **Endpoint**: none
- `ModelManifoldCard.tsx:406`
  - **Control (id)**: Stop Training (`train-btn-stop-{key}`)
  - **Handler**: `handleStopLocalTrain`
  - **Endpoint**: `POST /api/jobs/{id}/cancel` (8200)
- `ModelManifoldCard.tsx:420`
  - **Control (id)**: Local Training (`train-btn-start-{key}`)
  - **Handler**: `handleStartLocalTrain`
  - **Endpoint**: `POST /api/gui/quick-train` (8200)
- `ModelManifoldCard.tsx:437`
  - **Control (id)**: Cloud (`train-btn-cloud-{key}`)
  - **Handler**: `handleOpenCloudModal`
  - **Endpoint**: opens CloudTrainModal
- `ModelManifoldCard.tsx:464`
  - **Control (id)**: Push (`train-btn-pub-model-{key}`)
  - **Handler**: `handlePushArtifacts`
  - **Endpoint**: `POST /api/training/kaggle/push` (8200)
- `ModelManifoldCard.tsx:493`
  - **Control (id)**: Pull (`train-btn-pull-model-{key}`)
  - **Handler**: `handlePullArtifacts`
  - **Endpoint**: `POST /api/training/kaggle/pull` (8200)
- `ModelManifoldCard.tsx:522`
  - **Control (id)**: Training notebook (`train-btn-gen-nb-{key}`)
  - **Handler**: `handleGenerateTrainingNotebook`
  - **Endpoint**: `POST /api/notebooks/generate` (8200)
- `ModelManifoldCard.tsx:552`
  - **Control (id)**: Usage notebook (`train-btn-usage-nb-{key}`)
  - **Handler**: `handleGenerateUsageNotebook`
  - **Endpoint**: `POST /api/notebooks/generate` (8200)
- `ModelManifoldCard.tsx:582`
  - **Control (id)**: Evaluate (`train-btn-eval-{key}`)
  - **Handler**: `handleEvaluateModel`
  - **Endpoint**: `POST /api/training/evaluate` (8200)
- `ModelManifoldCard.tsx:611`
  - **Control (id)**: Export (`train-btn-export-{key}`)
  - **Handler**: `handleExportModel`
  - **Endpoint**: `POST /api/training/export` (8200)
- `ModelManifoldCard.tsx:640`
  - **Control (id)**: Generate Docs (none)
  - **Handler**: `handleGenerateDocs`
  - **Endpoint**: `POST /api/models/{key}/docs/generate` (8200)
- `ModelManifoldCard.tsx:670`
  - **Control (id)**: Stage Variations (none)
  - **Handler**: `handleStageVariations`
  - **Endpoint**: `POST /api/models/{key}/export/stage` (8200)
- `TelemetryConsole.tsx:119`
  - **Control (id)**: Local / Remote Cloud / Ecosystem Mesh segments (none)
  - **Handler**: `setActiveTelemetryTab`
  - **Endpoint**: none
- `TelemetryConsole.tsx:174`
  - **Control (id)**: Copy, Clear, Stop (local) (none)
  - **Handler**: copy/clear/`handleStopLocalTrain`
  - **Endpoint**: clipboard, `POST /api/jobs/{id}/cancel`
- `TelemetryConsole.tsx:213`
  - **Control (id)**: Copy, Clear (remote) (none)
  - **Handler**: copy/clear
  - **Endpoint**: none (stream never populated)
- `TrainingPanel.tsx:566`
  - **Control (id)**: Start Training Suite (none)
  - **Handler**: `handleStartService("training-suite")`
  - **Endpoint**: lifecycle as Dashboard
- `TrainingPanel.tsx:623`
  - **Control (id)**: Clear All Filters (none)
  - **Handler**: filter reset
  - **Endpoint**: none

### Clean Install Pipeline and Health

- `PipelineStepCards.tsx:258`
  - **Control (id)**: Run Step N Only, 7 buttons (none)
  - **Handler**: `handleRunPipelineStep(n)`
  - **Endpoint**: `POST /api/pipeline/run-step` (8000)
- `HealthPanel.tsx:38`
  - **Control (id)**: Start Environment Manager (none)
  - **Handler**: `onStartEnvManager`
  - **Endpoint**: lifecycle
- `HealthPanel.tsx:311`
  - **Control (id)**: Safe Package Upgrade (`health-btn-safe-upgrade`)
  - **Handler**: `handleSafeUpdate(false)`
  - **Endpoint**: `POST /api/update` (8000)
- `HealthPanel.tsx:322`
  - **Control (id)**: Upgrade Dry Run (`health-btn-upgrade-dry-run`)
  - **Handler**: `handleSafeUpdate(true)`
  - **Endpoint**: `POST /api/update` (8000)
- `HealthPanel.tsx:333`
  - **Control (id)**: Deep Cache Purge (`health-btn-deep-clean`)
  - **Handler**: `handleDeepClean`
  - **Endpoint**: `POST /api/clean` (8000)
- `HealthPanel.tsx:344`
  - **Control (id)**: Install Git Hooks (`health-btn-install-hooks`)
  - **Handler**: `handleInstallHooks`
  - **Endpoint**: `POST /api/hooks/install` (8000)
- `HealthPanel.tsx:355`
  - **Control (id)**: Run Ecosystem Validation (`health-btn-validate-ecosystem`)
  - **Handler**: `handleValidateEcosystem`
  - **Endpoint**: `POST /api/validate` (8000)

### Dialogs

- `ConfigEditorModal.tsx:79`
  - **Control (id)**: Registry Manifests / Secrets tabs (none)
  - **Handler**: `setActiveTab`
  - **Endpoint**: none
- `ConfigEditorModal.tsx:106`
  - **Control (id)**: Close (none)
  - **Handler**: `onClose`
  - **Endpoint**: none
- `ManifestEditorTab.tsx:128`
  - **Control (id)**: Manifest select (`manifest-select`)
  - **Handler**: `onSelectName`
  - **Endpoint**: `GET /api/manifests/read` (8000)
- `ManifestEditorTab.tsx:146`
  - **Control (id)**: Validate (none)
  - **Handler**: `handleValidate`
  - **Endpoint**: `POST /api/manifests/validate` (8000)
- `ManifestEditorTab.tsx:164`
  - **Control (id)**: Diff toggle (none)
  - **Handler**: `setShowDiff`
  - **Endpoint**: none
- `ManifestEditorTab.tsx:175`
  - **Control (id)**: Revert (none)
  - **Handler**: `handleRevert`
  - **Endpoint**: none
- `ManifestEditorTab.tsx:186`
  - **Control (id)**: Save (none)
  - **Handler**: `handleSaveManifest`
  - **Endpoint**: `POST /api/manifests/save` (8000)
- `ManifestEditorTab.tsx:236`
  - **Control (id)**: Content textarea (none, aria-label)
  - **Handler**: `setCurrentContent`
  - **Endpoint**: none
- `SecretsEditorTab.tsx:215`
  - **Control (id)**: Add secret toggle (none)
  - **Handler**: `setIsAddingSecret`
  - **Endpoint**: none
- `SecretsEditorTab.tsx:225`
  - **Control (id)**: Save Secrets (none)
  - **Handler**: `handleSaveSecretsToDisk`
  - **Endpoint**: `POST /api/secrets` (8000)
- `SecretsEditorTab.tsx:257`
  - **Control (id)**: Add form (`new-service-select`, `new-label-input`,
    `new-username-input`, `new-server-input`, `new-secret-input`)
  - **Handler**: `handleAddSecretSubmit`
  - **Endpoint**: none until save
- `SecretsEditorTab.tsx:375`
  - **Control (id)**: Add per service (none)
  - **Handler**: inline
  - **Endpoint**: none
- `SecretsEditorTab.tsx:424`
  - **Control (id)**: Reveal / Set default / Delete (none)
  - **Handler**: toggles
  - **Endpoint**: none until save
- `CloudTrainModal.tsx:153`
  - **Control (id)**: Close "X" (none)
  - **Handler**: `onClose`
  - **Endpoint**: none
- `CloudTrainModal.tsx:167`
  - **Control (id)**: Kaggle / Colab / Models Hub segments (none)
  - **Handler**: `setTargetPlatform`
  - **Endpoint**: none
- `CloudTrainModal.tsx:262`
  - **Control (id)**: GPU (`gpu-select`), Auto-pull checkbox (none)
  - **Handler**: setters
  - **Endpoint**: none
- `VariationIsolationChecker.tsx:45`
  - **Control (id)**: Generate Docs, Stage Variations (none)
  - **Handler**: handlers
  - **Endpoint**: `POST /api/models/{key}/docs/generate`, `POST
    /api/models/{key}/export/stage`
- `VariationIsolationChecker.tsx:136`
  - **Control (id)**: Variation (`variation-select`), Dry-run (none)
  - **Handler**: setters
  - **Endpoint**: none
- `CloudTrainModal.tsx:332`
  - **Control (id)**: Kaggle Notebook, Kaggle Model Hub links (none)
  - **Handler**: anchors
  - **Endpoint**: hardcoded owner URLs
- `CloudTrainModal.tsx:364`
  - **Control (id)**: Launch Cloud Training (none)
  - **Handler**: `handleLaunch`
  - **Endpoint**: `POST /api/training/kaggle/train` (8200)
- `CloudTrainModal.tsx:376`
  - **Control (id)**: Push to Kaggle Models (none)
  - **Handler**: `handlePushModel`
  - **Endpoint**: `POST /api/training/kaggle/push-model` (8200)
- `TestModal.tsx:116`
  - **Control (id)**: Close (`test-modal-btn-close`)
  - **Handler**: `onClose`
  - **Endpoint**: unreachable modal
- `TestModal.tsx:130`
  - **Control (id)**: Tabs (`test-modal-tab-fleet`, `-training`, `-dataset`)
  - **Handler**: `setActiveTab`
  - **Endpoint**: unreachable modal
- `TestModal.tsx:166`
  - **Control (id)**: Run fleet (`test-modal-btn-run-fleet`)
  - **Handler**: `handleRunFleetDiagnostic`
  - **Endpoint**: `POST /api/training/unit-test-all` (8200)
- `TestModal.tsx:184`
  - **Control (id)**: Run training unit (`test-modal-btn-run-training-unit`)
  - **Handler**: `handleRunTrainingUnitTests`
  - **Endpoint**: hardcoded `127.0.0.1:8200/api/training/unit-test-run`
- `TestModal.tsx:202`
  - **Control (id)**: Run dataset unit (`test-modal-btn-run-dataset-unit`)
  - **Handler**: `handleRunDatasetUnitTests`
  - **Endpoint**: hardcoded `127.0.0.1:8100/api/llm/test-suite`

Totals: 101 `button` elements and 41 form fields in source; 30 interactive
controls carry a stable static `id`, 12 more carry per-key dynamic IDs.

## Refactoring Plan (Proposed)

Ordered so each step keeps the three gates green.

1. **Shared primitives first** (`components/common/`): `Modal` (portal, focus
   trap, Escape, initial focus, focus return, `aria-modal`), `Tabs` (roving
   tabindex, `aria-selected`, `aria-controls`), `Banner` (reuse
   `ValidationBanner`), `Field` (label plus input binding). Migrate
   `ConfigEditorModal`, `CloudTrainModal`, `TestModal` and five segmented
   controls.
2. **`App.tsx` (614 lines)**: extract `viewRegistry.ts` (removes the four tab
   lists at `Sidebar.tsx:27-33`, `App.tsx:367-382`, `useStudioStore.ts:69`,
   `Sidebar.tsx:19-25`); extract hooks `useMeshStatus`,
   `useTelemetryStream`, `usePipelineRunner`, `useServiceLifecycle`
   (one `waitForReachable(serviceId, expectOnline, timeoutMs)` replaces the
   four copy-pasted poll loops at `App.tsx:230-238`, `App.tsx:300-307`,
   `App.tsx:325-332`, `App.tsx:350-357`). Target under 150 lines.
3. **`client.ts` (1335 lines)**: `http.ts` with one `request<T>()` (status
   check, JSON error `detail` parsing, timeout) replaces about 45
   near-identical fetch blocks; split per sidecar; move ANSI/progress/roll-up
   to `telemetry/`; move `normalizeSocketMessage` branches into a normalizer
   registry keyed by `ServiceId`; replace `isTauri` branches with a
   `ServiceLauncher` strategy; delete dead exports (`fetchProjects`,
   `fetchDocsStatus` unless wired to the docs button, `fetchKaggleStatus`,
   `fetchKaggleRegistryDatasets`, `fetchKaggleKernels`, `monitorKaggleKernel`,
   `trainLLM`, `blendModelSoup`) or wire them to UI.
4. **Types**: regenerate the three `openapi.json` files from live apps, then
   generate TypeScript types; remove hand-written duplicates in
   `src/api/types.ts` (566 lines) and the `RawModelData` adapter
   (`client.ts:598-648`) once the Training Suite returns a normalized model.
5. **`index.css` (1298 lines)**: split into `styles/tokens.css`, `base.css`,
   `a11y.css`, `layout.css`, and per-feature files; define the eight missing
   classes; convert the 579 inline style objects into classes; remove
   `!important`.
6. **Feature panels**: `CompilerPanel` into hooks `useCompilerCatalog`,
   `useKaggleTransfers`, `useModernizationQueue`, `useScaleReduction`;
   split `DatasetCompilationForm` (43 props) into `KaggleIngestBar`,
   `StandardCompileForm`, `CustomCompileForm` with typed value objects;
   `TrainingPanel` into `useModelCatalog`, `useTrainingJobs`, and a single
   `runModelAction(kind, key, fn)` helper replacing 11 repeated try/catch
   handlers (`TrainingPanel.tsx:248-441`); pass a `ModelActions` object to
   `ModelManifoldCard` instead of 14 callbacks.
7. **Fallback data**: delete `fallbackModels.ts` (603 lines),
   `fallbackDatasets.ts` (442 lines), `FALLBACK_PROJECTS`
   (`App.tsx:35-41`) and the manifest fallback
   (`ConfigEditorModal.tsx:36-43`); show explicit offline/empty states, or
   serve a build-time snapshot generated from the canonical registries.
8. **`vite.config.ts`**: remove application endpoints (`/api/dev/services/*`,
   `/api/model-telemetry/*`); keep at most the docs static mount; add
   `@types/node` plus `lib`/`target` to `tsconfig.node.json`; include it in
   `typecheck`.
9. **`src-tauri/`**: single service registry consumed by Rust and TS;
   track child processes in managed state and terminate on exit; redirect
   child stdout/stderr to log files; return spawn diagnostics; delete
   `check_server_status` and `spawn_sidecar` (unused, `let _ =` discard at
   `commands.rs:93`); add `capabilities/default.json`; enable CSP; add icons.

## Debug Report

- D1
  - **Issue**: Plaintext secrets readable by any web origin
  - **Severity**: Critical
  - **Root cause**: `GET /api/secrets` returns raw `secret_value` with no auth
    (`../lemgendary-env-manager/env_manager/server.py:674-692`) under CORS `*`
    (`server.py:108`); GUI reads and re-uses values
    (`src/api/client.ts:365-374`, `client.ts:814-828`); CSP disabled
    (`src-tauri/tauri.conf.json:24`)
  - **Fix**: Mask values server-side (return `has_value`, last 4 chars);
    write-only update endpoint; restrict CORS to Tauri and dev origins; require
    a local token; set a CSP [verified for code paths]
- D2
  - **Issue**: Test & Diagnostic modal unreachable
  - **Severity**: High
  - **Root cause**: `setIsTestModalOpen(true)` is never called
    (`src/App.tsx:66`, `App.tsx:603-609`); entry button removed in README
    v2.10.7
  - **Fix**: Either delete `TestModal.tsx` and its docs, or restore a header
    entry with id `header-btn-test-modal` [verified]
- D3
  - **Issue**: TestModal bypasses mesh SSOT
  - **Severity**: Medium
  - **Root cause**: Literal `http://127.0.0.1:8200` and `:8100`
    (`src/components/TestModal.tsx:49`, `TestModal.tsx:79`);
    `data.failures.join` crashes if field missing (`TestModal.tsx:62`, `:92`);
    fleet enqueue shown as PASSED (`TestModal.tsx:33`)
  - **Fix**: Add client functions using `TRAINING_BASE`/`DATASETS_BASE`; guard
    arrays; status `QUEUED` [verified]
- D4
  - **Issue**: Remote Cloud telemetry tab always empty
  - **Severity**: High
  - **Root cause**: `remoteEvents` only ever reset
    (`src/components/TrainingPanel.tsx:73`, `TrainingPanel.tsx:497`); Kaggle job
    lines arrive with origin `training-suite` and are routed to Local
    (`client.ts:1155-1163`)
  - **Fix**: Route events by `data.job_id === remoteJob.jobId` or `job_type`
    into the remote stream [verified]
- D5
  - **Issue**: Packaged build calls dev-only endpoints
  - **Severity**: High
  - **Root cause**: Relative URLs served only by Vite middleware:
    `/api/dev/services/*` (`client.ts:188`, `client.ts:201`),
    `/api/model-telemetry/*` (`client.ts:652`), `/documentation-hub/`
    (`src/components/Header.tsx:21`)
  - **Fix**: Move to sidecar endpoints (Training Suite already has
    `/api/models/{key}` and telemetry) or Tauri commands; use
    `fetchDocsStatus().local_url` for docs [high]
- D6
  - **Issue**: N+1 requests and 2 s poll against dev middleware
  - **Severity**: Medium
  - **Root cause**: `fetchModels` issues one telemetry fetch per model
    (`client.ts:667-673`); poll every 2 s while `localJob.modelKey` set
    (`TrainingPanel.tsx:172-202`); middleware reads CSV from disk synchronously
    (`vite.config.ts:249-300`)
  - **Fix**: Include live telemetry in `/api/gui/models/with-stats`; poll one
    endpoint [verified]
- D7
  - **Issue**: Tauri bundle icons missing
  - **Severity**: High
  - **Root cause**: `src-tauri/icons/` does not exist but
    `tauri.conf.json:29-35` references five icons; `tauri-build` needs
    `icons/icon.ico` for the Windows resource
  - **Fix**: Generate with `npx tauri icon` [high, cargo unavailable]
- D8
  - **Issue**: Stop Training reports success on failure
  - **Severity**: High
  - **Root cause**: `cancelTrainingJob` returns `false` on failure
    (`client.ts:792-803`) and the result is ignored
    (`TrainingPanel.tsx:263-270`)
  - **Fix**: Throw on `!cancelled`; keep job state until the sidecar confirms
    [verified against
    `../lemgendary-training-suite/training/server/routes/jobs.py:35-44`]
- D9
  - **Issue**: Local job never cleared on natural completion
  - **Severity**: Medium
  - **Root cause**: `setLocalJob` only on start, stop, or mount
    (`TrainingPanel.tsx:158`, `:252`, `:269`); no terminal-event handling
  - **Fix**: Clear on terminal WS event for the job id or poll `GET
    /api/jobs/{id}` [verified]
- D10
  - **Issue**: Fallback inventories poison the cache
  - **Severity**: High
  - **Root cause**: Fallbacks written to the store (`TrainingPanel.tsx:101-102`,
    `CompilerPanel.tsx:121-122`); effect skips refetch when cache non-empty
    (`TrainingPanel.tsx:124-131`), so a sidecar started later is not reflected
    until manual refresh; fallback models show fabricated statuses
    (`fallbackModels.ts:10-11`)
  - **Fix**: Never cache fallbacks; refetch on `trainingSuiteOnline`
    false-to-true transition; remove fabricated data [verified]
- D11
  - **Issue**: Effect re-entry on cache update
  - **Severity**: Low
  - **Root cause**: `cachedModels` in deps (`TrainingPanel.tsx:131`) re-runs
    `loadKaggleData()` after every refresh
  - **Fix**: Split effects; depend on online flag [verified]
- D12
  - **Issue**: Full-tree re-render per telemetry event
  - **Severity**: Medium
  - **Root cause**: `App` subscribes to `events` (`App.tsx:50`) and passes them
    to every view; `TrainingPanel` also uses selector-less `useStudioStore()`
    (`TrainingPanel.tsx:46-53`); cards not memoized
  - **Fix**: Select narrow slices; pass derived props; `React.memo` cards [high]
- D13
  - **Issue**: Swallowed errors (36 bare catches)
  - **Severity**: Medium
  - **Root cause**: e.g. `client.ts:371`, `:444`, `:455`, `:488`, `:498`,
    `:767`, `:787`, `:800`, `:841` return empty values; `App.tsx:205`,
    `TrainingPanel.tsx:119`, `:161`, `:196`, `ConfigEditorModal.tsx:52`,
    `CloudTrainModal.tsx:50`, `vite.config.ts:292`
  - **Fix**: Typed `ApiError`, log via a logger, surface state to UI; ROBOTS
    forbids silent swallowing [verified]
- D14
  - **Issue**: "Refresh failed" banner can never show
  - **Severity**: Medium
  - **Root cause**: Every awaited call inside `loadData` already catches
    (`App.tsx:100-104`, `refreshMeshStatus` catches at `App.tsx:82`), so
    `App.tsx:126-130` is dead; error cleared even when all calls failed
    (`App.tsx:125`)
  - **Fix**: Use `Promise.allSettled` and report rejected sources [verified]
- D15
  - **Issue**: `startService` hides HTTP errors and double-spawns
  - **Severity**: Medium
  - **Root cause**: Outer `catch` (`client.ts:237-240`) also catches the thrown
    non-OK response and falls back to the dev spawner
  - **Fix**: Only fall back on network errors (`TypeError`) [verified]
- D16
  - **Issue**: Start failures are silent
  - **Severity**: Medium
  - **Root cause**: Rust returns `Ok` once `spawn()` succeeds with stdio null
    (`src-tauri/src/commands.rs:68-81`); UI polls 15 s then reports nothing
    (`App.tsx:300-308`)
  - **Fix**: Return a timeout error from `waitForReachable`; log child output
    [verified]
- D17
  - **Issue**: Auto-start does nothing when Environment Manager is down
  - **Severity**: Medium
  - **Root cause**: `needsStart` only evaluated after a successful
    `fetchEcosystemMesh` (`App.tsx:221-245`); env-manager itself never
    considered; contradicts Paper section 6.5
  - **Fix**: Probe each service directly and start missing ones [verified]
- D18
  - **Issue**: Duplicate log lines after refresh
  - **Severity**: Low
  - **Root cause**: REST `recent_events` (raw, no `origin`/`port`) merged with
    WS-normalized events and de-duplicated by `JSON.stringify`
    (`App.tsx:114-119`)
  - **Fix**: Normalize REST events through the same normalizer and de-duplicate
    by `timestamp + step + message` [high]
- D19
  - **Issue**: Unhandled promise rejection
  - **Severity**: Low
  - **Root cause**: `import("@axe-core/react").then(...)` without `catch`
    (`src/main.tsx:6-10`)
  - **Fix**: Add rejection handling with logging [verified]
- D20
  - **Issue**: Config modal refetches on every manifest selection
  - **Severity**: Low
  - **Root cause**: `loadManifestList` depends on `selectedName`
    (`ConfigEditorModal.tsx:45`), effect depends on it (`:59-64`);
    `!selectedName` never true
  - **Fix**: Remove dependency; select first item only when list loads
    [verified]
- D21
  - **Issue**: Edits lost silently
  - **Severity**: Low
  - **Root cause**: Modal returns `null` when closed
    (`ConfigEditorModal.tsx:66`), unmounting tabs, but tooltip claims "Unsaved
    edits remain in memory" (`:114`); switching manifests discards edits without
    prompt
  - **Fix**: Lift draft state or confirm on discard [verified]
- D22
  - **Issue**: Undefined CSS classes
  - **Severity**: Medium
  - **Root cause**: `badge-danger`, `badge-secondary`, `badge-neutral`,
    `log-timestamp`, `log-step`, `log-message`, `log-error`, `log-empty` are not
    in `src/index.css`; FAILED badges render uncoloured
    (`PipelineStepCards.tsx:135`, `TestModal.tsx:112`, `TelemetryConsole.tsx`)
  - **Fix**: Define or map to existing `badge-error`, `log-time` [verified]
- D23
  - **Issue**: Broken ARIA tab relationships
  - **Severity**: Medium
  - **Root cause**: `aria-controls="panel-{id}"` targets non-existent IDs
    (`Sidebar.tsx:87`); tablists contain non-tab buttons (`Sidebar.tsx:100`,
    `ConfigEditorModal.tsx:89`, `:101`); modal tabs lack `id`/`aria-controls`
  - **Fix**: `Tabs` primitive; move help buttons outside tablists [verified]
- D24
  - **Issue**: Modals not keyboard-safe
  - **Severity**: Medium
  - **Root cause**: No focus trap, Escape, or focus return in
    `ConfigEditorModal.tsx:69`, `CloudTrainModal.tsx:143`, `TestModal.tsx:105`
  - **Fix**: `Modal` primitive [verified]
- D25
  - **Issue**: Unlabelled form fields
  - **Severity**: Medium
  - **Root cause**: `DatasetCompilationForm.tsx:119`, `:129`;
    `CompilerToolbar.tsx:172`, filters at `:206`, `:223`, `:243`;
    `TrainingToolbar.tsx:129`, `:163`, `:182`, `:202`; clear buttons with text
    "X" and no name (`CompilerToolbar.tsx:181`, `TrainingToolbar.tsx:138`)
  - **Fix**: Add `label`/`aria-label` [verified]
- D26
  - **Issue**: Help button inside checkbox label
  - **Severity**: Low
  - **Root cause**: `HelpTooltip` button nested in `label` toggles the checkbox
    (`CloudTrainModal.tsx:275-284`, `VariationIsolationChecker.tsx:151-160`)
  - **Fix**: Move tooltip outside label [high]
- D27
  - **Issue**: Segmented controls convey state by colour only
  - **Severity**: Low
  - **Root cause**: No `aria-pressed`/`aria-selected`
    (`CompilerToolbar.tsx:88-112`, `TelemetryConsole.tsx:119-166`,
    `CloudTrainModal.tsx:167-190`, `TestModal.tsx:130-156`,
    `DatasetCompilationForm.tsx:189-200`)
  - **Fix**: `Tabs` primitive [verified]
- D28
  - **Issue**: Progressbar wraps interactive content
  - **Severity**: Low
  - **Root cause**: `role="progressbar"` contains seven `HelpTooltip` buttons
    (`PipelinePanel.tsx:47-89`)
  - **Fix**: Use a list with a separate progressbar [verified]
- D29
  - **Issue**: Live region flooding
  - **Severity**: Low
  - **Root cause**: `aria-live="polite"` on a high-frequency log
    (`LogPanel.tsx:120-127`)
  - **Fix**: Announce milestones only via a separate status region [high]
- D30
  - **Issue**: Progress hidden for any "completed" text
  - **Severity**: Low
  - **Root cause**: Substring `"completed"` treated as terminal
    (`LogPanel.tsx:28`, `PipelineStepCards.tsx:117`), e.g. "epoch 3 completed"
  - **Fix**: Use status and `is_progress` only [high]
- D31
  - **Issue**: Fake pre-flight checks
  - **Severity**: Low
  - **Root cause**: Notebook template always READY, dataset always
    AUTO-DISCOVERED (`CloudTrainModal.tsx:209`, `:220`); Colab tab has no action
  - **Fix**: Back by real checks or remove [verified]
- D32
  - **Issue**: Hardcoded Kaggle owner
  - **Severity**: Medium
  - **Root cause**: `lemtreursi` in `CloudTrainModal.tsx:69-71`,
    `DatasetManifoldCard.tsx:228`
  - **Fix**: Derive from Kaggle secret username or `kaggle_ref` [verified]
- D33
  - **Issue**: Dev middleware path traversal
  - **Severity**: Low (dev only)
  - **Root cause**: `path.resolve(__dirname, "../lemgendary-docs",
    relativePath)` with raw `req.url` (`vite.config.ts:226-229`)
  - **Fix**: Normalize and verify prefix, or use `sirv` [high]
- D34
  - **Issue**: Destructive actions without confirmation
  - **Severity**: Low
  - **Root cause**: Deep Cache Purge, Safe Upgrade, Stop Service, Delete Secret
    fire immediately (`HealthPanel.tsx:333`, `:311`, `ServiceTiles.tsx:126`,
    `SecretsEditorTab.tsx:447`)
  - **Fix**: Confirmation dialog via `Modal` [verified]
- D35
  - **Issue**: Fixed timers not cleared
  - **Severity**: Low
  - **Root cause**: `setTimeout` without cleanup (`TrainingPanel.tsx:111`,
    `CompilerPanel.tsx:138`, `LogPanel.tsx:72`)
  - **Fix**: Track and clear on unmount [verified]
- D36
  - **Issue**: Stale Tauri globals
  - **Severity**: Low
  - **Root cause**: `vite-env.d.ts:3-7` declares Tauri v1 globals; code sniffs
    `__TAURI_INTERNALS__` via casts
  - **Fix**: Use `isTauri()` from `@tauri-apps/api/core` [high]
- D37
  - **Issue**: Unused shell plugin
  - **Severity**: Low
  - **Root cause**: `tauri-plugin-shell` initialized (`src-tauri/src/main.rs:8`)
    and npm package declared, no JS usage and no capability
  - **Fix**: Remove, or replace with `plugin-opener` for external links
    [verified]
- D38
  - **Issue**: External links in packaged app
  - **Severity**: Low
  - **Root cause**: `target="_blank"` anchors and `window.open` rely on WebView
    new-window behaviour
  - **Fix**: Use opener plugin [uncertain]
- D39
  - **Issue**: Default ladder conflicts with governance
  - **Severity**: Low
  - **Root cause**: Fallback spatial ladder `[256, 384, 512]` (`client.ts:680`)
    vs ROBOTS ladder `256 -> 384 -> 512 -> 640`; `completedEpochs >= 20` magic
    rule (`client.ts:712`)
  - **Fix**: Training Suite owns ladder and status [verified]
- D40
  - **Issue**: `vite.config.ts` never typechecked
  - **Severity**: Medium
  - **Root cause**: `tsconfig.node.json` lacks `types`, `lib`, `target`; 30
    errors
  - **Fix**: Add `@types/node`, fix config, add to `typecheck` [verified]
- D41
  - **Issue**: ESLint config downgrade
  - **Severity**: Low
  - **Root cause**: `jsx-a11y/no-autofocus` set to `warn` (`.eslintrc.json:42`)
    while `plugin:jsx-a11y/strict` sets error; ESLint 8 is end-of-life
  - **Fix**: Remove override; migrate to ESLint 9 flat config [verified]

## Documentation Findings

### Control Registry Drift

Source: `../lemgendary-docs/MD-Papers/GUI_CONTROL_REGISTRY.md` versus all
`id=` attributes in `src/**/*.tsx`.

- Control IDs in registry table
  - **Count**: 78
- Registry IDs present in code exactly
  - **Count**: 23
- Registry IDs missing from code
  - **Count**: 55
- Distinct `id` attributes in code not in registry
  - **Count**: 53 (36 interactive, 17 headings/landmarks)
- Interactive controls with no `id` at all
  - **Count**: majority of 101 buttons and 41 fields

Missing groups, with the nearest code equivalent where one exists:

- **Renamed**: `comp-input-custom-name` (code `custom-name-input`),
  `comp-select-custom-task` (`custom-task-select`),
  `comp-select-custom-format` (`custom-format-select`),
  `comp-textarea-sources` (`custom-sources-area`),
  `comp-select-reduce-manifold` (`reduce-manifold-select`),
  `dash-btn-clean-install` (`dash-btn-run-pipeline`), `train-card-btn-eval`
  (`train-btn-eval-{key}`), `train-card-btn-export` (`train-btn-export-{key}`),
  `train-card-btn-push` (`train-btn-pub-model-{key}`), `train-card-btn-pull`
  (`train-btn-pull-model-{key}`), `dash-nav-sidebar` (sidebar has no id; tabs
  are `tab-{view}`).
- **Exists without id**: `comp-mode-standard`, `comp-mode-custom`,
  `comp-btn-custom-compile`, `comp-btn-kaggle-download`,
  `comp-input-kaggle-custom-ref`, `comp-subtab-catalog`,
  `comp-subtab-modernize`, `comp-subtab-reduce`,
  `comp-btn-scan-modernize-queue`, `comp-btn-batch-modernize-all`,
  `comp-btn-dispatch-reduce`, `pipe-btn-run-step-1` to `-7`,
  `health-table-drift`, `drift-badge-sync`, `drift-badge-alert`,
  `telem-log-stream`, `dash-card-hardware`, `proj-card-training`,
  `proj-btn-reconcile-datasets`, `dash-badge-sidecar-status`,
  `train-modal-tab-upload`, `pipe-step-status-badge`,
  `pipe-step-progress-bar`.
- **Feature absent**: `header-btn-test-modal` and `train-btn-unit-test-all`
  (removed in README v2.10.7), `train-select-model` and `train-btn-launch`
  (no global model selector; per-card start), `comp-toggle-transcode` (no
  such toggle), `comp-tab-kaggle-download`, `comp-tab-kaggle-upload`,
  `comp-select-kaggle-registry`, `comp-select-kaggle-upload`,
  `comp-btn-kaggle-upload` (Kaggle sub-tabs replaced by per-card actions),
  `comp-slider-modernize-workers` (number input, not a range),
  `pipe-stage-1-hardware`, `pipe-stage-4-reqs`, `pipe-stage-6-verify`,
  `pipe-stage-7-health` (no `li` stages rendered).

Wrong endpoints in the registry:

- `dash-badge-sidecar-status` cites `WS /ws/telemetry`; no such socket exists
  (env-manager exposes `/ws/log` and `/ws/logs`).
- `health-table-drift` cites `GET /api/health/drift`; data comes from
  `GET /api/health` (env-manager also has `GET /api/drift`).
- `proj-btn-reconcile-datasets` cites `POST /api/services/start-all`; code
  calls `POST /api/pipeline/run` with `target_project`.
- `pipe-btn-run-step-N` cite `POST /api/pipeline/run`; code calls
  `POST /api/pipeline/run-step`.
- Stage names (registry rows 97-103: "Virtual Environment Setup",
  "Requirements Sync", "Package Installation", "Dependency Audit") disagree
  with the code and orchestrator ("Toolchain Audit", "Virtual Environments",
  "Requirements Sync & Install", "Dependency Audit & Upgrades";
  `src/components/PipelineStepCards.tsx:12-55`,
  `../lemgendary-env-manager/env_manager/orchestrator.py:133-204`).
- Workflow 4.2 cites `ws://127.0.0.1:8100/api/ws/jobs/{id}/logs`; the GUI
  subscribes to `/api/ws/events` only.
- Internal count inconsistencies: 22, 20, and 21 manifolds (rows at lines 52,
  64, 69, 71); section 1 lists ports 8000 and 8100 only; WCAG 2.1 here versus
  WCAG 2.2 in the paper.

### Manual Drift (`MANUAL_AI_STUDIO_GUI.md`)

- Section 2.1 item 2 and section 3.4 document a "Run Tests" header button that
  no longer exists.
- Section 2.1 callouts: list has 12 items, table has 11 rows with "3" used
  twice; "Refresh Audit" mapped to `POST /api/audit`, which does not exist;
  the brand title is described as a link but only the footer logo is.
- Docs Hub URL `http://localhost:1420/documentation-hub/index.html` is the
  Vite dev server, unavailable in a packaged build.
- Section numbering gaps: 2.1 jumps to 2.5; 3.2 jumps to 3.4.
- All 24 referenced images exist under `../lemgendary-docs/assets/`; they
  still show the removed button (not re-verified visually).

### Paper Drift (`PAPER_AI_STUDIO_GUI.md`)

- Section 6.9 cites `src/data/fallbackModels.ts`,
  `src/data/fallbackDatasets.ts`,
  and `src/data/guiControlRegistry.ts`; none exist (fallbacks live under
  `src/components/`, no control registry module exists). Counts "19 model
  specifications", "20 manifolds", "32 interactive UI elements" do not match
  23 fallback models or the 78-row registry.
- Section 6.6 documents `#header-btn-test-modal` (removed).
- Section 6.8 lists `lucide-react` and `recharts` (not dependencies).
- Section 6.9 claims a Monaco diff viewer (plain `textarea`) and an
  "encrypted credentials vault" (plaintext YAML served over HTTP).
- Section 6.11 claims a working Remote Cloud stream (never populated, D4)
  and embedded consoles in Compiler and Health views (they use the shared
  `LogPanel`, not the three-tab console).
- Section 6.5 claims stdout/stderr go to logs (Rust uses `Stdio::null`) and
  that all offline sidecars auto-start (D17).
- Section 1 claims "frozen OpenAPI 3.1 contracts" and backend `v16.9.16`;
  committed `openapi.json` versions are 2.0.0, 16.5.0, 16.2.9 and are stale.
- Section 2 claims virtualized windowing; the log renders up to 200 DOM rows
  without virtualization. Performance claims (under 45 MB, sub-millisecond)
  have no benchmark artifact **[uncertain]**.

### README and Version Drift

- `package.json`, `src-tauri/Cargo.toml`, and `tauri.conf.json` say `2.0.0`;
  README changelog tops out at `v2.10.7`; the paper says client `v2.0.0`.
- Changelog order is non-monotonic (v2.10.7 first, v3.6.0 last) and repeats
  `v2.7.0` and `v2.8.0`.
- v2.10.2 claims IDs such as `dashboard-tab-btn` and `theme-toggle-btn`;
  neither exists (tabs are `tab-dashboard`; there is no theme toggle).
- v2.10.5 claims "responsive execution cancellation" in TestModal; none
  exists.
- `package.json` `verify` script uses a Windows-only relative path
  (`..\\lemgendary-env-manager\\.venv\\Scripts\\lem-env.exe`). It is relative,
  so it does not breach the absolute-path rule, but it fails on POSIX and
  hardcodes a sibling venv layout (DIP). `.githooks/pre-commit` has the same
  `Scripts/` assumption. Prefer a small cross-platform resolver script or
  `lem-env` on `PATH`.

## Cross-Project Findings

### API Contracts

- Every GUI-consumed REST route exists in sidecar route code (verified via
  router prefixes: datasets `api/server.py:89-102`, training
  `training/server/app.py:131-140`, env-manager `env_manager/server.py`).
- Payload and response shapes spot-checked and consistent: `QuickTrainRequest`
  (`training/server/routes/gui.py:22-32`), job cancel
  (`routes/jobs.py:35-44`), unit-test and LLM test-suite responses
  (`routes/training.py:316-333`,
  `../lemgendary-datasets/api/routes/llm.py:114-130`).
- **Stale `openapi.json` in all three sidecars**: 27 GUI-consumed endpoints
  are absent, including `/api/pipeline/run-step`, `/api/hooks/install`,
  every `/api/kaggle/*` and `/api/modernize/*` route on 8100, and every
  `/api/training/kaggle/*`, `/api/notebooks/*`, and
  `/api/models/{key}/...` sub-route on 8200. Counts: env-manager 24 paths,
  datasets 25, training 19. This blocks type generation.
- Dataset Compiler `/api/ws/events` is an inline app route
  (`../lemgendary-datasets/api/server.py:104`), not documented anywhere in
  the registry.
- Auth: Dataset Compiler `config`, `jobs`, `env` routers require a token
  (`api/server.py:100-102`); the GUI does not call them. Training Suite auth
  is off by default (`create_app(enforce_auth=False)`,
  `training/server/app.py:67`); if enabled, every GUI call except health and
  WS would fail because the client sends no token.

### SSOT Violations

- Service id, folder, module, port
  - **Copies**: `src/api/config.ts:42-67`, `vite.config.ts:46-65`,
    `src-tauri/src/commands.rs:31-36`, env-manager service registry
  - **Authoritative owner**: One shared registry (env-manager)
- Models
  - **Copies**: `src/components/training/fallbackModels.ts` (23)
  - **Authoritative owner**: Training Suite `unified_models_v2.yaml`
- Datasets and presets
  - **Copies**: `src/components/compiler/fallbackDatasets.ts`
  - **Authoritative owner**: Dataset Compiler `unified_data.yaml`
- Projects
  - **Copies**: `App.tsx:35-41`, `types.ts:55-63`
  - **Authoritative owner**: `../ROBOTS.md` inventory via env-manager
- Manifests
  - **Copies**: `ConfigEditorModal.tsx:36-43`
  - **Authoritative owner**: env-manager `/api/manifests/registry`
- Pipeline steps
  - **Copies**: `PipelineStepCards.tsx:12-55`
  - **Authoritative owner**: `env_manager/orchestrator.py`
- Tabs and titles
  - **Copies**: `Sidebar.tsx:27-33`, `App.tsx:367-382`, `useStudioStore.ts:69`,
    `Sidebar.tsx:19-25`
  - **Authoritative owner**: `viewRegistry.ts`
- Port numbers in UI text
  - **Copies**: about 35 literal "8000/8100/8200" strings outside `config.ts`
  - **Authoritative owner**: `MESH_SERVICES[...].defaultPort`
- Model status heuristics
  - **Copies**: `client.ts:675-765`
  - **Authoritative owner**: Training Suite
- Kaggle owner slug
  - **Copies**: `CloudTrainModal.tsx:69-71`, `DatasetManifoldCard.tsx:228`
  - **Authoritative owner**: Secrets vault username

### Security (ecosystem)

- CORS `allow_origins=["*"]` with `allow_credentials=True` on env-manager
  (`env_manager/server.py:108`) and Training Suite
  (`training/server/app.py:120-126`). Combined with unauthenticated mutation
  endpoints (start/stop services, pipeline runs, manifest save, secrets
  save), any web page open in the user's browser can drive the local mesh
  via simple requests. Restrict origins to `tauri://localhost`,
  `http://tauri.localhost`, and `http://localhost:1420`, and require a
  per-install token header.

## Bug-Report Frontend Integration Notes

Already-known plan problems (Gmail app password on clients, Electron-only
`chromeMediaSourceId`, non-existent `screenCapture` capability and missing
`src-tauri/capabilities/`, relative `fetch("/gui/bug-report")`,
`@ts-expect-error`, PNG versus WebP) are confirmed and not repeated.

### How Existing Patterns Are Structured

- **Modals**: three hand-rolled overlays, each `role="dialog"` on the
  backdrop, `aria-labelledby` to a heading, no focus management
  (`ConfigEditorModal.tsx:69`, `CloudTrainModal.tsx:143`,
  `TestModal.tsx:105`). Open state is local `useState` in `App.tsx:65-66` and
  `TrainingPanel.tsx:86`; `?modal=` deep link handled ad hoc
  (`App.tsx:64-65`).
- **Header entry points**: optional callback props
  (`Header.tsx:8`, `onOpenConfigEditor`), each button paired with a
  `HelpTooltip`.
- **API client**: one exported async function per endpoint using
  `MESH_SERVICES` bases and `err.detail` parsing (`client.ts:376-387`
  pattern); types in `src/api/types.ts`.
- **Tauri**: four commands, no capabilities, `csp: null`, shell plugin with
  no permissions.

### Idiomatic Integration

1. Build the shared `Modal` primitive first; `BugReportModal` and
   `ScreenshotAnnotator` compose it. Do not add a fourth bespoke overlay.
2. State: replace scattered booleans with `activeModal:
   "config" | "test" | "bugReport" | null` in the store, which also
   generalizes the `?modal=` deep link. The plan's `useStudioStore()`
   destructuring in its section 7 subscribes `App` to the entire store; use
   selectors.
3. Header: add `onOpenBugReport` following `onOpenConfigEditor`; use an id
   that follows the registry taxonomy (for example
   `header-btn-report-issue`, not `btn-report-issue`); no emoji in labels
   (the plan uses a bug emoji and a dingbat cross, which conflict with the
   ecosystem zero-emoji gate); reuse existing `btn` variants instead of a
   new `btn-danger-outline`.
4. Client: add `submitBugReport(payload): Promise<BugReportResponse>` (or
   `src/api/bugReport.ts`) that builds `FormData` and posts to a base from
   `MESH_SERVICES`. Note the real path would be `/api/gui/bug-report`
   (router prefix `/gui` plus app prefix `/api`), not `/gui/bug-report`,
   even after switching to `TRAINING_BASE`.
5. Host choice: the Training Suite is the sidecar most likely to be the
   subject of a bug report, so it is the worst host. Prefer the Environment
   Manager (coordinator, already owns secrets) or, better, a Tauri command
   (`invoke("submit_bug_report")`) so no unauthenticated localhost HTTP
   endpoint can send mail.
6. CSP: once enabled, the page needs `connect-src` for the three HTTP and WS
   bases, `img-src 'self' data: blob:` for thumbnails, `media-src blob:` for
   recording preview, and either self-hosted fonts or Google Fonts origins
   (`index.html:10`). The 579 inline styles currently require
   `style-src 'unsafe-inline'`.

### Additional Plan Problems

- **Missing dependency**: FastAPI `Form`/`File` require `python-multipart`;
  the plan says no new Python packages are needed (section 12.2), and no
  requirements file in `../lemgendary-training-suite` declares it
  **[verified absent from manifests]**.
- **CSRF mail relay**: a multipart POST is a CORS simple request (no
  preflight), so with CORS `*` and no token any website could make the
  user's machine send email through the configured account.
- **Secrets mismatch**: the plan stores `BUG_REPORT_SMTP_PASS` in the vault
  (section 10) but the service reads `os.environ`; the vault writes a YAML
  file (`env_manager/server.py:695+`) and does not set the Training Suite's
  process environment.
- **Telemetry file format**: `buildTelemetryCsv` emits one comma-joined row
  with no header (section 3.4); it is not valid tabular CSV. Use NDJSON of
  `PipelineEvent` (with `origin`) and redact token-like strings, because log
  lines can contain credentials or user paths.
- **"Current panel" claim**: the global `events` buffer is not per-panel
  (overview versus section 7).
- **html2canvas**: last release 1.4.1 (2022); known fidelity gaps for
  `backdrop-filter` and complex shadows used in `index.css`; the modal must
  be hidden during capture or it captures itself **[uncertain on fidelity]**.
- **Recording portability**: `MediaRecorder` with `video/webm;codecs=vp9`
  is unsupported on WebKit (macOS WKWebView, Linux WebKitGTK); feature-detect
  with `MediaRecorder.isTypeSupported`. In WebView2, `getDisplayMedia` shows
  a picker and cannot be constrained to the app window from script
  **[uncertain]**; the "enforced at the Tauri native layer" GDPR statement
  in the plan overview has no implementation behind it. Consider native
  window capture in Rust or dropping recording from v1.
- **Size**: about 17 MB raw plus about 33 percent base64 MIME overhead is
  roughly 22.6 MB, close to the 25 MB Gmail limit; the soft warning at
  20 MB (raw) is too late.
- **Paper structure**: the plan adds section 9 after section 8 Conclusion,
  breaking the ROBOTS-mandated eight-section structure; fold it into
  section 6.
- **Versioning**: the plan bumps `v2.0.0` to `v2.0.1` while README is at
  `v2.10.7`; resolve version drift first.
- **Registry**: new IDs should be added only alongside fixing the existing
  55-ID drift, otherwise the registry stays untrustworthy.
- **Privacy**: the archive includes the user's email and telemetry sent to a
  third-party mailbox; add an explicit consent checkbox and retention note.

## Proposed Changelog Entries

Proposed only; nothing below has been implemented. Version number to be
decided after the version drift is resolved.

```markdown
### vNEXT - Lead Architect Review Remediation (proposed)

- **Security**: Secrets are masked in GUI reads; CSP enabled in
  `src-tauri/tauri.conf.json`; external links routed through the opener plugin.
- **Packaging**: Added `src-tauri/icons/` and `src-tauri/capabilities/default.json`;
  removed unused `tauri-plugin-shell`, `check_server_status`, `spawn_sidecar`.
- **Production parity**: Removed GUI dependence on Vite dev middleware
  (`/api/dev/services/*`, `/api/model-telemetry/*`, `/documentation-hub/`).
- **Training**: Remote Cloud telemetry stream now receives Kaggle job events;
  Stop Training surfaces cancellation failures; local job clears on completion.
- **SSOT**: Removed fallback model, dataset, project, and manifest inventories;
  introduced `viewRegistry.ts`; single service registry shared with Tauri.
- **Accessibility**: Shared `Modal` and `Tabs` primitives (focus trap, Escape,
  ARIA tab relationships); labelled all form fields; defined missing badge and
  log classes.
- **Error handling**: Replaced 36 silent catch blocks with typed `ApiError`
  propagation and visible UI state.
- **Tooling**: `vite.config.ts` added to typecheck with `@types/node`;
  removed the `jsx-a11y/no-autofocus` downgrade.
- **Test & Diagnostic Orchestrator**: Entry point restored (or modal removed)
  and endpoints routed through `MESH_SERVICES`.
```

## Remaining Recommendations (Ranked)

1. Fix secrets exposure and CORS across env-manager and Training Suite (D1,
   Security). Prerequisite for any bug-report mail feature.
2. Make the packaged Tauri build viable: icons, capabilities, CSP, remove
   dev-middleware dependencies (D5, D7, D37).
3. Decide TestModal fate and reconcile registry, manual, paper, and README
   (D2, Documentation Findings).
4. Repair training job lifecycle: remote stream, cancel result, completion
   (D4, D8, D9).
5. Remove fallback inventories and fix cache poisoning (D10, SSOT table).
6. Regenerate all three `openapi.json` files and generate client types.
7. Replace silent catches with typed errors and visible states (D13 to D17).
8. Build `Modal`/`Tabs`/`Field` primitives and fix accessibility (D23 to D29).
9. Decompose `App.tsx`, `client.ts`, `index.css`, `CompilerPanel.tsx`,
   `TrainingPanel.tsx` per the Refactoring Plan.
10. Unify the service registry across TypeScript, Vite, Rust, and
    env-manager; track and log child processes.
11. Typecheck `vite.config.ts`; migrate ESLint 9; remove the a11y rule
    downgrade (D40, D41).
12. Resolve version drift (`package.json` 2.0.0 versus README v2.10.7) and
    reorder the changelog.
13. Only then implement the Report Issue feature per the integration notes.

## Remediation Status (Medium and Low Findings)

Step L10-GUI on branch `fix/review-remediation`. Critical and High findings
were fixed in earlier steps. Commits: `d91e35a` (v2.10.26), `0f288cb`
(v2.10.27), `470b196` (v2.10.28), and the v2.10.29 commit that adds this
section.

- D3
  - **Severity**: Medium
  - **Status**: Fixed earlier
  - **Where / why**: v2.10.14: mesh URLs, guarded arrays, `QUEUED` status
- D6
  - **Severity**: Medium
  - **Status**: Fixed earlier
  - **Where / why**: v2.10.16: one `with-stats` request, 5 s poll
- D9
  - **Severity**: Medium
  - **Status**: Fixed earlier
  - **Where / why**: v2.10.15: job status poll clears the local job
- D11
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `0f288cb`: load once on mount
- D12
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `0f288cb`: event-bound views; App and TrainingPanel do not
    subscribe to `events`
- D13
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: v2.10.21 logs every catch; v2.10.29 routes the last
    `console.*` calls through `logger`. List readers still return `[]` with a
    logged warning (by design: offline fallback)
- D14
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `d91e35a`: `Promise.allSettled`, banner names failed
    sources
- D15
  - **Severity**: Medium
  - **Status**: Fixed earlier
  - **Where / why**: v2.10.16: no dev-spawner fallback; HTTP errors surface
- D16
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `d91e35a`: start timeout error; native spawn logs output to
    the app log folder
- D17
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `d91e35a`: direct probes, Environment Manager started first
- D18
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `d91e35a`: REST events normalized, de-duplicated by
    timestamp, step, message
- D19
  - **Severity**: Low
  - **Status**: Fixed earlier
  - **Where / why**: v2.10.24: dynamic import rejection logged
- D20
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: registry loads once per opening
- D21
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: confirm before discarding unsaved manifest edits
- D22
  - **Severity**: Medium
  - **Status**: Fixed earlier
  - **Where / why**: v2.10.17: classes defined; coverage test
- D23
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `470b196`: `Tabs` primitive; sidebar is a `nav`
- D24
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `470b196`: Test, Cloud and Config dialogs use `Modal`
- D25
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `470b196`: labels on search, filters, clear buttons, Kaggle
    inputs
- D26
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: help buttons outside checkbox labels
- D27
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: tabs via `Tabs`; other toggles expose
    `aria-pressed`
- D28
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: progressbar separate from the step list
- D29
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `0f288cb`: logs `aria-live="off"`; milestones in a status
    region
- D30
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `0f288cb`: `isTerminalEvent` replaces the "completed"
    substring test
- D31
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: pre-flight rows say what is not checked; Colab
    tab says no launch
- D32
  - **Severity**: Medium
  - **Status**: Fixed
  - **Where / why**: `470b196`: owner from Kaggle credentials or `kaggle_ref`.
    Offline placeholders in `fallbackDatasets.ts` still carry `kaggle_ref`
    strings (data, deferred to L7 with the inventory SSOT)
- D33
  - **Severity**: Low
  - **Status**: Not applicable
  - **Where / why**: v2.10.16 removed the docs middleware; no path handling left
    in `vite.config.ts`
- D34
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: `ConfirmDialog` for upgrade, purge, stop
    service, delete credential
- D35
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `0f288cb`: `useTransientValue` clears its timer
- D36
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: v2.10.29: stale Tauri v1 globals removed (code already uses
    `isTauri()`)
- D37
  - **Severity**: Low
  - **Status**: Not applicable
  - **Where / why**: The shell plugin is now used for `open` (v2.10.16,
    `shell:allow-open`)
- D38
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: `470b196`: `ExternalLink` opens through `openExternalUrl`
- D39
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: v2.10.15 removed the fallback ladder; v2.10.29 drops the
    `completedEpochs >= 20` rule
- D40
  - **Severity**: Medium
  - **Status**: Fixed earlier
  - **Where / why**: v2.10.18
- D41
  - **Severity**: Low
  - **Status**: Fixed
  - **Where / why**: Downgrade removed in v2.10.21. v2.10.31 migrates to ESLint
    9 flat config (`eslint.config.js`) with `typescript-eslint` 8 and
    `eslint-plugin-react-hooks` 5

Deferred to step L7 (cross-repo SSOT): service ids, folders, modules and
ports are still duplicated in `src/api/config.ts` and
`src-tauri/src/commands.rs`; fallback model, dataset, project and manifest
inventories remain.

Backend items (not changed here): the Training Suite should always send
`training_status` and `is_fully_trained` in `GET /api/gui/models/with-stats`
so the GUI needs no status fallback; the Environment Manager's
`recent_events` should always carry `timestamp` so REST and WebSocket
de-duplication is exact.
