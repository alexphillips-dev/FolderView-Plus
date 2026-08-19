# Docker Runtime Architecture

This document tracks the staged modularization of `docker.js` while preserving Unraid selector/API compatibility.

## Runtime Modules

- `scripts/runtime.host-adapter.js`
  - Defines the versioned Docker and VM host-page contracts.
  - Owns host table/body/row discovery, structure validation, row observation, and idempotent global hook wrapping.
- `scripts/runtime.host-compatibility.js`
  - Detects legacy table, native component, and unknown Docker host generations before the legacy runtime initializes.
  - Owns the no-overlay coexistence decision and aggregate compatibility evidence.
- `scripts/docker.runtime.providers.js`
  - Defines legacy WebGUI, hybrid legacy/GraphQL, Unraid GraphQL, and unsupported providers for container listing, identity, subscriptions, actions, health metadata, guarded mutations, organization authority, and UI ownership.
- `scripts/docker.runtime.capabilities.js`
  - Owns dynamic capability-path checks, unavailable/legacy snapshots, provider accessors, and privacy-safe compatibility evidence mapping.
- `scripts/docker.runtime.api-coordinator.js`
  - Owns API-first list and targeted reconciliation for the legacy Docker renderer.
  - Merges only schema-confirmed runtime fields into the PHP-authoritative identity/metadata map, serializes requests, rejects stale work, schedules structural host refreshes only for verified configuration revisions, and applies permanent/transient failure policy.
- `scripts/docker.runtime.container-model.js`
  - Normalizes GraphQL, PHP runtime, and DOM fallback records into one immutable container contract.
- `scripts/docker.runtime.provider-health.js`
  - Owns bounded provider-health refresh, aggregate severity derivation, caching, and disposal outside the legacy runtime monolith.
- `scripts/docker.runtime.layout-geometry.js`
  - Owns DOM-independent geometry sampling and comparison used by Docker layout diagnostics.
  - Separates whole-row movement from action movement inside a row so delayed hydration evidence identifies the actual source of visual bounce.
- `scripts/docker.runtime.column-controller.js`
  - Owns Docker app-column measurement, cached-width bootstrap, gap enforcement, reflow scheduling, theme/viewport/font hooks, resizer observation, and teardown.
  - Receives runtime state and host dependencies from `docker.js`; it does not own Docker rows, preferences, or render orchestration.
- `scripts/docker.runtime.refresh-diagnostics.js`
  - Owns bounded, privacy-safe Docker session summaries, reload-source attribution, native busy-cycle evidence, API mismatch aggregates, and the automatic refresh-loop verdict.
  - Counts completed renders by monotonic render generation, while `docker.runtime.diagnostics.js` remains the single owner of deferred page-snapshot scheduling.
  - Retains five completed sessions and never stores container names, identifiers, API payloads, URLs, call stacks, or host process details.
- `scripts/runtime.folder-ordering.js`
  - Owns deterministic folder depth, saved-order slot replacement, and Docker order reconciliation shared by Docker, VM, and Dashboard.
  - Preserves live folder-slot order for the default created mode while applying explicit sort and pin preferences consistently.
- `scripts/runtime.live-refresh.js`
  - Owns interval cadence, visibility gating, in-flight exclusion, release delay, snapshots, and disposal for Docker, VM, and Dashboard.
  - Each surface retains its own snapshot request, signature comparison, and incremental reconciliation callback.
- `scripts/docker.bootstrap.js`
  - Re-detects the fully parsed Docker host, prepares the selected provider, and loads the legacy runtime only after a complete legacy table contract is confirmed.
  - Keeps legacy CSS and custom Docker overrides disabled on native and unknown hosts.
- `scripts/runtime.transport.core.js`
  - Owns CSRF-aware GraphQL requests, normalized transport errors, stale/abort handling, and privacy-safe request diagnostics.
- `scripts/runtime.transport.subscription.js`
  - Owns WebSocket, server-sent-event, and polling subscription lifecycles with bounded reconnect and disposal.
- `scripts/runtime.transport.docker-actions.js`
  - Owns typed Docker lifecycle actions and capability-gated Docker mutations.
- `scripts/runtime.transport.js`
  - Preserves the public transport API and owns operation-signature capability detection while composing the request, subscription, and Docker-action modules.
- `scripts/docker.runtime.shared.js`
  - `createRuntimeStateStore`: single source of truth for runtime UI state.
  - `createAsyncActionBoundary`: normalized async error handling and user-safe messaging.
  - `createContextMenuQuickStripAdapter`: resilient context-menu enhancement for icon-only quick actions.
  - `createRuntimePerfTelemetry`: structured action timing with snapshot support.
  - `createSafeUiActionRunner`: in-flight dedupe for UI-triggered async actions.
  - `resolveRuntimePerformanceProfile`: resolves the Standard, Adaptive, and Maximum runtime performance profiles.
  - `runtimeContracts`: shared key/threshold contracts consumed by Docker and VMs.
- `scripts/docker.modules.js`
  - view helpers (debug logger, perf tracker, row-centering tools).

## Runtime Ownership

- `docker.bootstrap.js` is the only production loader for `docker.js`, which starts only for the complete legacy table contract. The runtime keeps legacy Docker rendering and domain orchestration while Unraid page integration goes through the shared host adapter and the extracted column controller.
- The native Docker component remains owned by Unraid. FolderView Plus does not overlay it or mutate the prerelease organizer.
- On the legacy table, UI ownership remains unchanged while the API coordinator prefers schema-confirmed GraphQL list/targeted reads and falls back to PHP reconciliation.
- Dashboard advanced previews open GraphQL statistics lazily and fall back to the host `docker_load` stream.
- `docker.runtime.host-guards.js` is the Docker diagnostics facade over the shared adapter; it does not implement a second hook or selector system.
- Shared modules own reusable primitives so feature logic is testable without large-file rewrites.
- Store-backed state currently includes:
  - `focusedFolderId`
  - `lockedFolderIds`
  - `pinnedFolderIds`
  - `performanceProfile`

## Performance Profiles

- **Standard** keeps the normal motion and refresh behavior, restores expanded folders without a profile-imposed cap, and renders previews immediately unless the user explicitly enables deferred previews.
- **Adaptive** is recommended for most installations. It uses a moderate refresh floor and expansion cap, then increases those safeguards when folder count, member count, or measured render time indicates a large library. Deferred previews activate when requested or when those large-library thresholds are active.
- **Maximum** always applies the strongest runtime safeguards: reduced motion, deferred previews, the smallest expanded-folder restore limit, and the longest minimum refresh interval.

The runtime still uses an internal threshold state while resolving Adaptive and Maximum behavior. That state is an implementation detail, not a fourth user-selectable profile.

## Guardrails

- Shared modules load in `folderview.plus.Docker.page` before `docker.bootstrap.js`.
- Bootstrap repeats host detection after parsing, then enables legacy styles, loads legacy custom overrides in sequence, and finally loads `docker.js` only for a confirmed complete table contract.
- Native and unknown generations keep every legacy stylesheet inert and return before custom overrides, adapters, hooks, requests, observers, or jQuery prefilters are created.
- Unraid lifecycle globals (`loadlist`, `listview`, `openDocker`, `eventControl`, and `addDockerContainerContext`) are wrapped idempotently by the adapter, with compatibility aliases retained for host/plugin interoperability.
- Context menu quick actions (Focus/Pin/Lock) are enhanced through the adapter rather than ad-hoc DOM logic.
- CSS layout constants use tokenized variables with hard-coded fallback values to preserve legacy contracts.
- Preview hydration diagnostics record unavailable WebUI slots, disconnected targets, absolute movement, row movement, and movement relative to the owning row without retaining container or folder identities.
- The main Docker runtime line budget is ratcheted from 8,839 to 8,028 lines. Column layout/control moved behind a lifecycle-owned factory, while reusable ordering and live-refresh seams reduced duplicate ownership across Docker, VM, and Dashboard.

## Regression Prevention

- Architecture contract tests:
  - `tests/docker-runtime-shared-architecture.test.mjs`
  - `tests/runtime-host-adapter.test.mjs`
  - `tests/docker-folder-row-quick-actions.test.mjs`
  - `tests/docker-mobile-name-alignment-guard.test.mjs`
  - `tests/docker-runtime-diagnostics-geometry.test.mjs`
  - `tests/phase3-runtime-seams.test.mjs`
  - `tests/unraid-docker-future-compatibility.test.mjs`
  - `tests/unraid-upstream-monitor.test.mjs`
- Deterministic native-host browser coverage:
  - `tests/browser/fixtures/future-docker-host.html`
- Deterministic current/legacy API-first browser coverage:
  - `tests/browser/fixtures/docker-api-legacy.html`
  - `tests/fixtures/unraid-api/*.json`
- Perf telemetry snapshot is exposed as:
  - `window.getDockerRuntimePerfTelemetrySnapshot()`
  - `window.getVmRuntimePerfTelemetrySnapshot()`

See [Unraid Docker API Integration](unraid-docker-api-integration.md) for the capability, fallback, mutation, privacy, and monitoring contracts.
