# VM Runtime Architecture

`vm.js` now shares the same runtime primitives used by Docker:

- `createRuntimeStateStore`
- `createAsyncActionBoundary`
- `createRuntimePerfTelemetry`
- `createSafeUiActionRunner`
- `resolveRuntimePerformanceProfile`
- `runtime.host-adapter.js` for host table discovery, structure validation, row observation, and lifecycle hook ownership

## Runtime State

Store-backed VM runtime state tracks:

- `expandedFolderIds`
- `inFlightAction`
- `performanceProfile`

## Guardrails

- Shared runtime script is included in `folderview.plus.VMs.page` before `vm.js`.
- The shared host adapter is included before `vm.js`; VM code no longer maintains a separate selector preflight or `loadlist` wrapper.
- Folder actions/custom actions run through guarded async boundaries and in-flight dedupe.
- Strict performance profile auto-activates only when performance mode is enabled and folder/item counts exceed shared thresholds.

## Observability

- `window.getVmRuntimePerfTelemetrySnapshot()`
- `window.getVmRuntimeStateSnapshot()`
- `window.getVmHostAdapterSnapshot()`
