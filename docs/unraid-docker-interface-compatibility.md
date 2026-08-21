# Unraid Docker Interface Compatibility

This document defines how FolderView Plus coexists with the current table-based Unraid Docker page and the native component/API replacement being developed by Unraid.

The upstream implementation was last reviewed on 2026-08-21 against Unraid API v4.37.2. That release adds TXZ-install cleanup for stale Unraid API web-component files without changing the Docker interface, generated Docker GraphQL contract, native Docker page, or organizer implementation. The generated Docker contract retained the reviewed signature, and Unraid's [`docker-containers-page` file modification](https://github.com/unraid/api/blob/main/api/src/unraid-api/unraid-file-modifier/modifications/docker-containers-page.modification.ts) still returned `shouldApply: false`, while its replacement markup contained `<unraid-docker-container-overview>`. The native Docker implementation therefore remains prerelease, and safe mode plus the existing organizer boundary remain unchanged.

## Host generations

`scripts/runtime.host-compatibility.js` detects a Docker host from page capabilities and shape rather than an Unraid version string:

| Generation | Required evidence | FolderView Plus behavior |
| --- | --- | --- |
| `legacy-docker-table` | Complete `#docker_containers`, `#docker_list`, and header contract | Start the existing FolderView Plus Docker runtime |
| `native-docker-vue` | Native `unraid-docker-container-overview` component | Leave the Docker page owned by Unraid; do not add folders or wrap legacy hooks |
| `unknown-docker-host` | Neither supported contract is complete | Leave the page untouched and record compatibility evidence |

Native detection wins if native and legacy elements briefly coexist. This prevents duplicate folder systems during a transitional render.

The detector records only aggregate booleans and versions. It does not record container names, IDs, paths, addresses, URLs, or native organizer contents.

`scripts/docker.bootstrap.js` repeats detection after the page has parsed. Only a confirmed legacy host enables the FolderView Plus Docker styles, loads user Docker overrides, and loads `docker.js`. Native and unknown hosts therefore do not receive dormant legacy selectors or custom-script side effects.

## Provider boundary

`scripts/docker.runtime.providers.js` exposes the same operations through four providers:

- `legacy-webgui`
- `hybrid-legacy-graphql`
- `unraid-graphql`
- `unsupported-unknown`

The boundary covers:

- List containers.
- Resolve container identity.
- Read status metadata.
- Subscribe or poll for runtime changes.
- Execute capability-approved lifecycle actions.
- Describe the organization authority.
- Describe whether FolderView Plus may own a UI surface.

Legacy table hosts select the hybrid provider. The API coordinator enriches the PHP-authoritative runtime map from schema-confirmed GraphQL list and targeted reads while Unraid's `eventControl` continues to own lifecycle actions. A failed or unavailable GraphQL read falls back to PHP reconciliation without delaying the renderer. A host without `eventControl` can use GraphQL actions only after the API schema confirms the required query and mutation.

## GraphQL contract

`scripts/runtime.transport.js` performs an availability and operation-signature capability probe before using Docker API operations, then delegates requests, subscriptions, and typed actions to its focused transport child modules. It supports both:

- Current schema shape: `docker { containers { ... } }`
- Previously documented shape: `dockerContainers { ... }`

Lifecycle mutations use Unraid's `DockerMutations` and pass the API-returned container identity as `PrefixedID`. `resume` maps to the schema's `unpause` mutation. Start, stop, restart, pause, and unpause are enabled independently; an older API without restart support does not receive a restart request.

The capability matrix also detects targeted reads, networks, port conflicts, bounded logs, update status, rich container fields, Docker statistics, update/remove/autostart mutations, and digest refresh. Feature-flagged fields remain unavailable when absent from introspection. Limited fallback probing enables only the container query shape it directly verifies.

Requests:

- Send the signed-in webGUI session cookies with same-origin credentials.
- Send `x-csrf-token` when Unraid exposes `csrf_token`.
- Distinguish authentication, permission, rate-limit, unavailable, timeout, abort, stale-response, partial-data, and schema-capability failures.
- Abort or ignore stale work when a newer keyed request supersedes it.
- Keep raw server messages, identifiers, endpoints, and request values out of transport diagnostics.

Subscriptions cleanly close and have bounded exponential reconnect behavior. When a compatible Docker subscription is unavailable, a provider can use non-overlapping polling.

See [Unraid Docker API Integration](unraid-docker-api-integration.md) for the normalized model, hybrid provider, targeted reconciliation, aggregate health, guarded mutations, and privacy rules.

## Native organizer coexistence

Unraid owns organization on the native Docker page. FolderView Plus:

- Does not overlay its folder rows on the native component.
- Does not invoke native organizer mutations.
- Does not read or write the organizer backing file directly.
- Detects organizer query/mutation availability only for compatibility diagnostics.
- Does not migrate FolderView Plus folders into native folders until Unraid publishes a stable supported schema and a separately reviewed migration design exists.

FolderView Plus continues to own its saved folder data, rules, health policy, privacy policy, backups, Settings experience, diagnostics, and current Dashboard/VM features. Native Docker-page coexistence does not delete or rewrite those settings.

## Compatibility evidence

Sanitized support bundles include `uiTelemetry.dockerDiagnostics.compatibility` with:

- Host generation and page-shape booleans.
- Presence of supported classic hooks.
- Selected provider and fallback state.
- GraphQL endpoint availability and API/Unraid versions when queryable.
- Container query shape.
- Per-action mutation availability.
- Subscription availability.
- Native organizer query/mutation detection with the fixed `detect-only` policy.
- Aggregate API coordinator state, last source, failure category, cooldown, and in-flight/structural-refresh booleans.

The browser fixture `future-docker-host.html` verifies that a native page:

- Produces no fatal runtime error.
- Receives no FolderView Plus folder rows or action bar.
- Has no legacy host hooks wrapped.
- Keeps its component markup unchanged.
- Initializes sanitized capability evidence.
- Releases provider resources on navigation.

The `docker-api-legacy.html` fixture and `tests/fixtures/unraid-api/*.json` verify current API enrichment, targeted reads, CSRF propagation, host-owned actions, absent/limited APIs, permission failures, transient cooldowns, partial data, schema drift, and the no-overlay native boundary without connecting to a server.

## Activation triggers

`scripts/unraid_docker_upstream_monitor.sh` treats any of these as a Docker/API review signal:

1. Upstream `docker-containers-page.modification.ts` changes to `shouldApply: true`.
2. Supplied official release notes announce a native/new Docker page or interface.
3. The tracked Docker GraphQL schema signature changes or a required capability disappears.
4. The latest official Unraid API release differs from the reviewed baseline.

An unrecognizable source shape is also a blocking signal because silently assuming the replacement remains disabled would be unsafe. The daily workflow `.github/workflows/unraid-docker-upstream-monitor.yml` combines that focused check with `scripts/unraid_compatibility_monitor.mjs`. It also compares reviewed stable/prerelease Unraid versions, PHP runtimes, exact Docker/VM/Dashboard webGUI file signatures, the official Community Applications starter contract, the public catalog listing, and portal guidance. A drift issue never approves or rewrites a baseline automatically.

See [Unraid Docker Prerelease Qualification](unraid-docker-prerelease-qualification.md) before changing the coexistence policy.
