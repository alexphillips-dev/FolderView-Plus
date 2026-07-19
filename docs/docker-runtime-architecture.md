# Docker Runtime Architecture

This document tracks the staged modularization of `docker.js` while preserving Unraid selector/API compatibility.

## Runtime Modules

- `scripts/runtime.host-adapter.js`
  - Defines the versioned Docker and VM host-page contracts.
  - Owns host table/body/row discovery, structure validation, row observation, and idempotent global hook wrapping.
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

- `docker.js` keeps Docker rendering and domain orchestration while Unraid page integration goes through the shared host adapter.
- `docker.runtime.host-guards.js` is the Docker diagnostics facade over the shared adapter; it does not implement a second hook or selector system.
- Shared modules own reusable primitives so feature logic is testable without large-file rewrites.
- Store-backed state currently includes:
  - `focusedFolderId`
  - `lockedFolderIds`
  - `pinnedFolderIds`
  - `performanceProfile`

## Guardrails

- New shared module is loaded in `folderview.plus.Docker.page` before `docker.modules.js` and `docker.js`.
- Unraid lifecycle globals (`loadlist`, `listview`, `openDocker`, `eventControl`, and `addDockerContainerContext`) are wrapped idempotently by the adapter, with compatibility aliases retained for host/plugin interoperability.
- Context menu quick actions (Focus/Pin/Lock) are enhanced through the adapter rather than ad-hoc DOM logic.
- CSS layout constants use tokenized variables with hard-coded fallback values to preserve legacy contracts.

## Regression Prevention

- Architecture contract tests:
  - `tests/docker-runtime-shared-architecture.test.mjs`
  - `tests/runtime-host-adapter.test.mjs`
  - `tests/docker-folder-row-quick-actions.test.mjs`
  - `tests/docker-mobile-name-alignment-guard.test.mjs`
- Perf telemetry snapshot is exposed as:
  - `window.getDockerRuntimePerfTelemetrySnapshot()`
  - `window.getVmRuntimePerfTelemetrySnapshot()`
