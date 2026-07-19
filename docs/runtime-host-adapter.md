# Runtime Host Adapter

`scripts/runtime.host-adapter.js` is the single boundary between FolderView Plus and the Unraid Docker/VM host pages. It keeps host-page assumptions out of feature modules and gives both runtimes the same lifecycle and diagnostics behavior.

## Contract

Each immutable host contract defines:

- the native table, header, and body selectors;
- folder, item, and native detail row selectors;
- row identity lookup rules;
- required host-page structure checks; and
- the global host hooks the runtime may wrap.

Docker and VM adapters expose the same API for table/body discovery, row queries, row classification, structure checks, batched row observation, lifecycle hook wrapping/restoration, disposal, and diagnostics snapshots.

## Ownership

The adapter owns host integration only. Docker and VM runtimes still own folder rendering, hierarchy, actions, status models, and feature-specific UI. Docker's host-guard module adds fatal/degraded reporting around the adapter but does not maintain a separate selector or hook implementation.

Hook wrapping is idempotent: rebinding updates the handler without stacking wrappers. Original functions retain their compatibility aliases, their `this` value and arguments are preserved, and adapters can restore the original hook during disposal.

## Diagnostics

The live snapshots are available as:

- `window.getDockerHostAdapterSnapshot()`
- `window.getVmHostAdapterSnapshot()`

Snapshots include structure issues, native/folder/detail row counts, active row observers, and hook availability, wrapping state, call counts, and invocation timestamps.

## Regression Coverage

- `tests/runtime-host-adapter.test.mjs` validates both immutable contracts, DOM discovery, row identity, hook idempotency/restoration, observer batching, disposal, and structure errors.
- `scripts/fixture_browser_tests.mjs` validates the same adapter behavior in a real browser fixture.
- Docker/VM architecture tests enforce page include order and prevent runtimes from reintroducing independent host selectors or wrapper markers.
