# Unraid Docker API Integration

This document defines how FolderView Plus uses Unraid's GraphQL Docker API while preserving the legacy webGUI lifecycle and older Unraid compatibility.

## Ownership model

UI ownership and data transport are separate decisions:

| Host surface | UI owner | Preferred data transport | Action owner |
| --- | --- | --- | --- |
| Legacy Docker table | Unraid legacy page plus FolderView Plus overlay | GraphQL when capability probing succeeds; DOM/PHP fallback | Unraid `eventControl` |
| Dashboard Docker widget | Unraid Dashboard plus FolderView Plus cards/previews | Existing server payloads plus lazy GraphQL statistics | Existing host bridge when present; GraphQL only when required and supported |
| Native Docker component | Unraid | GraphQL capability detection | Unraid; FolderView Plus remains in safe coexistence mode |
| Unknown Docker host | Unknown | None | None |

The `hybrid-legacy-graphql` provider is selected for a complete legacy Docker-table contract. It uses GraphQL for supported reads and retains the host bridge for lifecycle actions so Unraid's spinners, callbacks, notifications, and table refresh remain synchronized.

Legacy runtime activation never waits for GraphQL discovery. Capability and aggregate-health enrichment run in the background with bounded timeouts and a registry-owned abort signal that is cancelled on navigation or disposal.

## Capability matrix

`scripts/runtime.transport.js` composes the transport child modules and introspects field names, arguments, return types, deprecation state, Docker container fields, root mutations, nested Docker mutations, and subscriptions. Request mechanics live in `runtime.transport.core.js`, subscription lifecycles in `runtime.transport.subscription.js`, and typed actions in `runtime.transport.docker-actions.js`. Each supported operation has a capability record with:

- Availability.
- Schema path.
- Argument names and types.
- Return type.
- Deprecation state.
- A normalized signature suitable for compatibility evidence.

Unraid and API version strings are informational. Runtime behavior is gated by the live schema because feature flags can remove fields entirely.

When introspection is unavailable, FolderView Plus performs bounded shape probes for current `docker.containers` and legacy `dockerContainers`. Limited mode never assumes targeted reads, rich fields, mutations, logs, port conflicts, or subscriptions.

## Normalized container model

`scripts/docker.runtime.container-model.js` normalizes GraphQL, PHP runtime, and legacy DOM records into one immutable structure. The model includes:

- Stable and short identities plus normalized names.
- Runtime state and status.
- Image and command metadata.
- Autostart state, order, and wait.
- Ports, LAN mappings, mounts, host network mode, and network settings.
- Template, project, registry, support, icon, WebUI, and shell metadata.
- Orphan, update, rebuild, Tailscale, and size state when available.

Raw model values remain in browser runtime memory. Compatibility diagnostics export only aggregate capability and health counts, never container names, IDs, paths, addresses, URLs, labels, mount values, or log content.

## Reads and reconciliation

The GraphQL provider:

1. Builds a container selection from fields confirmed by introspection.
2. Caches the last normalized identity map.
3. Resolves actions from that cache before performing a full list request.
4. Uses `docker.container(id)` for targeted reconciliation when available.
5. Falls back to `docker.containers`, legacy `dockerContainers`, or the legacy provider as appropriate.

`scripts/docker.runtime.api-coordinator.js` makes those reads useful to the legacy renderer without creating a second UI owner:

1. The PHP runtime snapshot builds the authoritative identity set, folder membership, ordering, URLs, paths, ports, mounts, and other metadata used by the grouped DOM.
2. After the legacy page renders, one background GraphQL list read enriches matching rows with schema-confirmed state, status, autostart, update, WebUI, icon, image, orphan, and rebuild fields.
3. Routine live refresh checks only PHP configuration revisions, then asks the coordinator for API runtime state. It does not call the legacy Docker runtime endpoint when the API path is healthy.
4. A lifecycle follow-up first uses `docker.container(id)` when available. Missing targeted-read capability falls back to a list read; an unavailable API falls back to the existing PHP reconciliation path.
5. API identities are matched by normalized name or unambiguous full/short ID. A changed identity set never creates or deletes a rendered row; it schedules one host-owned structural refresh.

The coordinator permits one request at a time, aborts and rejects stale work on disposal, permanently disables the API path for authentication, permission, missing-capability, or missing-fetch failures, and applies 15, 30, 60, 120, then 300 second cooldowns for transient failures. Successful reads clear the cooldown. Compatibility evidence receives only aggregate coordinator state, source, timestamps, failure category, counters, and cooldown duration.

## Statistics lifecycle

Dashboard advanced previews subscribe to `dockerContainerStats` only while the preview is open. The subscription:

- Uses `graphql-transport-ws` with same-origin session authentication and CSRF connection parameters.
- Updates the visible CPU/memory values and graph series.
- Falls back to Unraid's existing `docker_load` stream when GraphQL statistics are unavailable or fail.
- Closes on preview dismissal, provider disposal, navigation, or `pagehide`.
- Uses bounded reconnect behavior and does not overlap a fallback stream after GraphQL becomes active.

Statistics are telemetry, not a container lifecycle authority. Container list/state changes still use host events or explicit reconciliation.

## Read-only health metadata

When supported, the provider collects aggregate:

- Update-available container count.
- Rebuild-ready container count.
- Orphaned container count.
- Container-port conflict count.
- LAN-port conflict count.
- Number of containers affected by conflicts.

Only counts and availability state are stored in compatibility evidence. The source names and IDs used to calculate a count are discarded.

## Mutations

The transport supports individually gated:

- Start, stop, restart, pause, and unpause.
- Update one, multiple, or all eligible containers.
- Remove a container, optionally with its image.
- Refresh Docker digests.
- Update autostart entries with optional persisted user preferences.

Legacy Docker-page lifecycle buttons continue to use `eventControl`. GraphQL update/remove/autostart methods are provider capabilities for explicitly reviewed workflows; they are not substituted into a host-owned UI merely because a schema field exists.

Every mutation:

- Requires successful capability probing.
- Resolves the API-returned `PrefixedID`.
- Validates required identifiers or entry lists.
- Reconciles the targeted container or refreshes the normalized list afterward.
- Uses existing request timeout, abort, stale-response, authentication, permission, and rate-limit handling.

Autostart GraphQL persistence remains capability-gated and is not exposed by FolderView Plus UI. The existing Unraid preference path remains authoritative until an isolated, reproducible mutation contract proves order, wait values, persistence, rollback, and legacy UI synchronization.

API container reads enrich state only when they match the native PHP/DOM identity set. A full-list or targeted identity mismatch is diagnostic evidence, not a reason to call the host `loadlist()` function. FolderView Plus records only provider-only/runtime-only counts and first/last observation times, while native configuration revisions remain the structural refresh authority.

## Bounded logs

The provider can request a 1–500-line Docker log tail when `docker.logs` is available. This is an internal API for a future explicitly reviewed troubleshooting surface:

- It resolves a `PrefixedID`.
- It supports the upstream `since` cursor.
- It does not log requests, variables, returned messages, or container identity.
- It never includes Docker log content in support bundles.

## Native Organizer policy

Organizer detection remains `detect-only`. A qualification record can report:

- Organizer query detected.
- Organizer mutation detected.
- Native page activation observed.
- Migration design reviewed.

Integration remains disabled regardless of those individual booleans until Unraid activates and documents the interface and a separate migration design is approved. No organizer query contents, mutations, or backing files are used today.

## Upstream tracking

`scripts/unraid_docker_upstream_monitor.sh` and `scripts/unraid_docker_schema_signature.mjs` track:

- The native Docker-page `shouldApply` gate.
- Official activation wording in supplied release notes.
- A normalized signature of the relevant Docker GraphQL types and operations.
- Required schema tokens.
- The latest Unraid API release tag.

The reviewed baseline is `docs/unraid-docker-upstream-baseline.json`. A gate change, schema change, missing required token, or newer API release produces a review signal and opens or updates the scheduled compatibility issue. Monitoring never changes runtime behavior automatically.

## Validation

Focused contracts live in:

- `tests/unraid-docker-future-compatibility.test.mjs`
- `tests/docker-runtime-api-coordinator.test.mjs`
- `tests/unraid-api-fixtures.test.mjs`
- `tests/unraid-upstream-monitor.test.mjs`
- `tests/docker-runtime-shared-architecture.test.mjs`
- `tests/browser/fixtures/docker-api-legacy.html`
- `tests/browser/fixtures/future-docker-host.html`

The isolated API profile set covers full, absent, introspection-denied, limited-shape, targeted-read-missing, partial-data, permission-denied, rate-limited, unavailable, schema-drift, and future-native outcomes. Browser smoke, theme, responsive, and scheduled validation all run local fixtures; the repository has no live-Unraid target or secret contract. See `docs/unraid-docker-prerelease-qualification.md`.
