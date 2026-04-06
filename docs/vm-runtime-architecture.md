# VM Runtime Architecture

`vm.js` now shares the same runtime primitives used by Docker:

- `createRuntimeStateStore`
- `createAsyncActionBoundary`
- `createRuntimePerfTelemetry`
- `createSafeUiActionRunner`
- `resolveRuntimePerformanceProfile`

## Runtime State

Store-backed VM runtime state tracks:

- `expandedFolderIds`
- `inFlightAction`
- `performanceProfile`

## Guardrails

- Shared runtime script is included in `folderview.plus.VMs.page` before `vm.js`.
- Folder actions/custom actions run through guarded async boundaries and in-flight dedupe.
- Strict performance profile auto-activates only when performance mode is enabled and folder/item counts exceed shared thresholds.

## Observability

- `window.getVmRuntimePerfTelemetrySnapshot()`
- `window.getVmRuntimeStateSnapshot()`
