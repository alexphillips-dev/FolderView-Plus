# VM Runtime Architecture

`vm.js` now shares the same runtime primitives used by Docker:

- `createRuntimeStateStore`
- `createAsyncActionBoundary`
- `createRuntimePerfTelemetry`
- `createSafeUiActionRunner`
- `resolveRuntimePerformanceProfile`
- `runtime.host-adapter.js` for host table discovery, structure validation, row observation, and lifecycle hook ownership
- `runtime.folder-ordering.js` for folder depth and deterministic folder-slot ordering
- `runtime.live-refresh.js` for cadence, visibility gating, in-flight exclusion, and teardown

## Runtime State

Store-backed VM runtime state tracks:

- `expandedFolderIds`
- `inFlightAction`
- `performanceProfile`

## Guardrails

- Shared runtime script is included in `folderview.plus.VMs.page` before `vm.js`.
- The shared host adapter is included before `vm.js`; VM code no longer maintains a separate selector preflight or `loadlist` wrapper.
- The ordering and live-refresh modules are included before `vm.js`; VM retains its snapshot/reconciliation policy but no longer owns timer or in-flight lifecycle state.
- Folder actions/custom actions run through guarded async boundaries and in-flight dedupe.
- The VM entrypoint line budget is ratcheted from 4,010 to 3,945 lines. Dashboard reuses the same seams and is ratcheted from 3,173 to 3,152 lines.

## Performance Profiles

- **Standard** keeps normal motion and refresh behavior, restores expanded folders without a profile-imposed cap, and renders previews immediately unless deferred previews are explicitly enabled.
- **Adaptive** is the recommended profile. It applies moderate refresh and expansion safeguards, then strengthens them when VM folder count, member count, or measured render time crosses the shared large-library thresholds.
- **Maximum** always uses reduced motion, deferred previews, the smallest expanded-folder restore limit, and the longest minimum refresh interval.

Docker and VM runtimes resolve these same three profiles through `resolveRuntimePerformanceProfile`. The internal threshold state used by Adaptive and Maximum is not a separate user-selectable profile.

## Observability

- `window.getVmRuntimePerfTelemetrySnapshot()`
- `window.getVmRuntimeStateSnapshot()`
- `window.getVmHostAdapterSnapshot()`
