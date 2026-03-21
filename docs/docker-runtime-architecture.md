# Docker Runtime Architecture

This document tracks the staged modularization of `docker.js` while preserving Unraid selector/API compatibility.

## Runtime Modules

- `scripts/docker.runtime.shared.js`
  - `createRuntimeStateStore`: single source of truth for runtime UI state.
  - `createAsyncActionBoundary`: normalized async error handling and user-safe messaging.
  - `createContextMenuQuickStripAdapter`: resilient context-menu enhancement for icon-only quick actions.
  - `createRuntimePerfTelemetry`: structured action timing with snapshot support.
  - `createSafeUiActionRunner`: in-flight dedupe for UI-triggered async actions.
  - `resolveRuntimePerformanceProfile`: strict performance profile for large libraries.
  - `runtimeContracts`: shared key/threshold contracts consumed by Docker and VMs.
- `scripts/docker.modules.js`
  - view helpers (debug logger, perf tracker, row-centering tools).

## Runtime Ownership

- `docker.js` keeps orchestration and Unraid integration behavior.
- Shared modules own reusable primitives so feature logic is testable without large-file rewrites.
- Store-backed state currently includes:
  - `focusedFolderId`
  - `lockedFolderIds`
  - `pinnedFolderIds`
  - `performanceProfile`

## Guardrails

- New shared module is loaded in `folderview.plus.Docker.page` before `docker.modules.js` and `docker.js`.
- Context menu quick actions (Focus/Pin/Lock) are enhanced through the adapter rather than ad-hoc DOM logic.
- CSS layout constants use tokenized variables with hard-coded fallback values to preserve legacy contracts.

## Regression Prevention

- Architecture contract tests:
  - `tests/docker-runtime-shared-architecture.test.mjs`
  - `tests/docker-folder-row-quick-actions.test.mjs`
  - `tests/docker-mobile-name-alignment-guard.test.mjs`
- Perf telemetry snapshot is exposed as:
  - `window.getDockerRuntimePerfTelemetrySnapshot()`
  - `window.getVmRuntimePerfTelemetrySnapshot()`
