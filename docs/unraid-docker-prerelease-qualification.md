# Unraid Docker Prerelease Qualification

Use this checklist when a new Unraid prerelease, Unraid API package, or Unraid Connect build changes Docker behavior. It is deliberately stricter than normal patch validation because the future native page replaces the host surface that FolderView Plus currently enhances.

## 1. Confirm the upstream activation state

Run:

```bash
bash scripts/unraid_docker_upstream_monitor.sh --json
```

Review the official Unraid release notes as well. If the monitor reports `active` or `unknown`, do not change the detector to force legacy mode. Open a compatibility task and preserve native-page safe mode until qualification is complete.

## 2. Record the test matrix

Test at least:

| Lane | Required host |
| --- | --- |
| Current stable | Oldest supported Unraid and latest stable Unraid |
| Prerelease | Latest available Unraid prerelease containing Docker/API changes |
| API early warning | Newer supported Unraid API or Unraid Connect build when it can be installed without replacing the OS |
| Browser | Current Chrome/Edge, Firefox, and Safari/WebKit |
| Responsive | Desktop and smartphone widths |
| Theme | Default light and dark themes |

Record the Unraid version, API version, plugin version, detected host generation, and selected provider. Do not put server identifiers or user workload details in the qualification record.

## 3. Validate legacy Docker behavior

On a `legacy-docker-table` host:

1. Confirm FolderView, Host list, and Command views load.
2. Confirm folder membership, nested expansion, manual order, autostart order, and wait values remain stable.
3. Confirm start, stop, pause, resume, and restart use the legacy host action bridge.
4. Confirm repeated Docker/Settings/Dashboard navigation creates no duplicate handlers, observers, requests, or rows.
5. Confirm Dashboard and VM features still behave normally.

## 4. Validate native Docker coexistence

On a `native-docker-vue` host:

1. Confirm the native Docker page renders without a FolderView Plus fatal banner.
2. Confirm FolderView Plus adds no table, folder row, action bar, context menu, observer, or legacy-hook wrapper.
3. Confirm native folders appear only once and remain controlled by Unraid.
4. Confirm navigating away closes GraphQL subscriptions/timers and aborts stale work.
5. Confirm Settings, backups, diagnostics, rules, health, privacy, Dashboard, and VMs remain accessible.
6. Confirm no FolderView Plus data is deleted or automatically migrated.

## 5. Validate GraphQL capabilities

Use the signed-in local webGUI session:

1. Confirm the endpoint probe reports availability without exposing its URL.
2. Confirm API and Unraid versions are recorded when `info.versions.core` is available.
3. Confirm current `docker.containers` and older `dockerContainers` shapes are handled as detected.
4. Confirm container identities returned by the API are passed back as `PrefixedID`.
5. Confirm each lifecycle action is offered only when its mutation exists.
6. Confirm an API without `restart` never receives a restart mutation.
7. Confirm authentication, permission, rate-limit, partial-data, offline, timeout, abort, and stale-response paths are non-fatal.
8. Confirm WebSocket reconnect is bounded and disposal prevents reconnect after navigation.
9. Confirm every browser GraphQL request includes the available CSRF token.
10. Confirm the operation matrix records arguments, return types, and deprecation state without retaining the raw schema.
11. Confirm the legacy table selects `hybrid-legacy-graphql`, GraphQL supplies supported reads, and lifecycle actions still use `eventControl`.
12. Confirm targeted reconciliation falls back to a list request when `docker.container(id)` is absent.
13. Confirm port-conflict, update, rebuild, and orphan diagnostics contain aggregate counts only.
14. Confirm the Dashboard statistics subscription opens only for a visible preview, falls back to `docker_load`, and closes on dismissal/navigation.
15. Confirm update/remove/digest/autostart mutations are unavailable unless their exact schema operations are present.

## 6. Validate organizer ownership

The expected result remains:

- Organizer query/mutation capabilities may be detected.
- FolderView Plus does not read organizer content for rendering.
- FolderView Plus does not call organizer mutations.
- FolderView Plus does not write organizer files.
- FolderView Plus does not show a second folder hierarchy on the native page.

Any proposed migration requires its own schema review, conflict model, backup/rollback design, explicit user confirmation, and cross-version tests.

The Organizer qualification record exposed by the provider remains informational and always reports `integrationAllowed: false` until that separate review is complete.

## 7. Validate diagnostics and privacy

Export a sanitized support bundle and inspect `uiTelemetry.dockerDiagnostics.compatibility`:

1. Host generation, page shape, API version, capability booleans, provider, fallback, subscription state, and organizer policy are present.
2. No container/VM/folder names or IDs are present.
3. No paths, IPs, URLs, CSRF values, cookies, tokens, GraphQL variables, raw schema response, or server error text are present.
4. Unknown and native safe modes remain actionable without being reported as a fatal plugin failure.

## 8. Run repository validation

At minimum:

```bash
node --test tests/unraid-docker-future-compatibility.test.mjs tests/unraid-upstream-monitor.test.mjs
bash scripts/run_ci_suite.sh --lane lint --lane tests
bash scripts/run_ci_suite.sh --lane fixture-browser
npm run test:runtime-performance
bash scripts/release_guard.sh
bash scripts/install_smoke.sh
```

Also run configured live browser and theme matrix smoke tests against the prerelease host.

The weekly `Scheduled Cross-Browser and Unraid Validation` workflow always runs the deterministic fixture suite in Chromium, Firefox, and WebKit. Configure all three repository secrets below to enable its live lane:

- `FVPLUS_UNRAID_MATRIX`
- `FVPLUS_BROWSER_SMOKE_URL`
- `FVPLUS_THEME_MATRIX_URLS`

The live lane explicitly marks the Unraid matrix, browser smoke, and theme matrix as required. Release-mode validation uses the same fail-closed contract.

## 9. Make the release decision

Do not enable native-page integration merely because fields exist in an unpublished schema. A release can move beyond safe coexistence only when:

- Unraid has activated and documented the replacement.
- The required schema and permissions are public and stable.
- The full matrix above passes.
- Folder ownership and migration behavior have explicit product decisions.
- Rollback preserves both FolderView Plus and native organizer data.
- Sanitized support evidence is sufficient to diagnose failures without user workload data.

Until all conditions are met, keep native Docker-page ownership with Unraid and retain FolderView Plus functionality on unaffected surfaces.
