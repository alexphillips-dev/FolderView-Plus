# Unraid Docker API Qualification

Use this checklist when a new Unraid release, Unraid API package, or Unraid Connect build changes Docker behavior. Qualification is intentionally isolated and reproducible: repository validation does not connect to a live Unraid server and does not require server URLs, cookies, CSRF values, or credentials.

## 1. Review the upstream contract

Run:

```bash
bash scripts/unraid_docker_upstream_monitor.sh --json
```

Review the official Unraid release notes and generated API contract. If the monitor reports `active` or `unknown`, do not force legacy mode. Preserve native-page safe mode, update the reviewed schema baseline only after inspecting the upstream change, and add an isolated fixture that represents the new host or schema outcome.

The scheduled compatibility workflow also runs `scripts/unraid_compatibility_monitor.mjs` against `docs/unraid-compatibility-baseline.json`. Review every reported stable/prerelease OS, PHP, webGUI, plugin-manager, API, and Community Applications signal. Plugin-manager coverage includes the install, update, downgrade, removal, pre/post-check, and change-display paths that can affect FolderView Plus installation and updates. Baseline changes are human-reviewed repository updates; the workflow intentionally cannot approve upstream drift itself.

## 2. Maintain the isolated profile matrix

Profiles live in `tests/fixtures/unraid-api/`. Every profile is synthetic and must contain no real server, user, workload, path, address, URL, token, or cookie data.

| Profile | Required result |
| --- | --- |
| `current-full-api` | Current list and targeted reads enrich matching PHP runtime rows |
| `legacy-no-api` | Legacy PHP/DOM behavior remains fully usable |
| `current-introspection-denied` | Bounded shape probing enables only proven reads |
| `current-limited-shape` | Optional fields and mutations stay disabled |
| `current-targeted-read-missing` | Lifecycle follow-up uses a list read |
| `current-partial-data` | Partial response is rejected and PHP fallback remains usable |
| `current-permission-denied` | API use is disabled for the page lifecycle |
| `current-rate-limited` | A bounded cooldown is applied before retry |
| `current-service-unavailable` | A bounded cooldown and PHP fallback are used |
| `current-schema-drift` | Unknown/missing capabilities are never assumed |
| `future-native-host` | Unraid retains native page and organizer ownership |

When an upstream change cannot be expressed by an existing profile, add one minimal profile and a contract test before changing runtime behavior.

## 3. Validate supported PHP runtimes

`scripts/php_runtime_compatibility.sh` syntax-checks every shipped PHP file and executes a standalone request-authority contract. The scheduled workflow runs it in three isolated container profiles matching the oldest supported Unraid release, the current stable release, and the current prerelease recorded in `docs/unraid-compatibility-baseline.json`.

PHP patch changes in official Unraid release notes are review signals. Update the matrix only after the image exists, the full shipped PHP surface passes, and any new deprecation or behavior difference is understood.

## 4. Validate Community Applications publication

`scripts/community_applications_guard.mjs` compares the stable repository metadata and manifest with:

- The official Community Applications repository XML guidance.
- The official starter plugin contract.
- The canonical `unraid-ca-templates` FolderView Plus entry.
- The public Community Applications feed entry.
- The version currently published through the stable plugin manifest.

The interactive portal's authenticated **Validate** and **Scan** actions remain a manual release/submission check. CI uses only public inputs and never stores a Community Applications login or browser session.

## 5. Validate legacy API-first reads

The expected sequence on a legacy Docker table is:

1. PHP builds the authoritative identity set and grouped DOM.
2. One background GraphQL list read enriches matching rows.
3. Routine refresh uses GraphQL runtime state while PHP checks configuration revisions.
4. Lifecycle follow-up uses `docker.container(id)` when supported and a list read otherwise.
5. A changed identity set schedules one host refresh; API data never invents or removes rows directly.
6. API failure falls back to PHP without blocking FolderView, Host list, Command view, folder membership, ordering, or actions.

API state may update running, paused, status, autostart, and only optional fields proven by introspection. PHP metadata such as paths, ports, mounts, shell, template links, project data, and fallback URLs must remain intact.

## 6. Validate lifecycle and mutation ownership

On the legacy Docker page and Dashboard:

- Start, stop, pause, resume, and restart remain individually capability-gated.
- When Unraid `eventControl` exists, it remains the action owner so host spinners, notifications, callbacks, and refresh behavior stay synchronized.
- Dashboard shows only actions supported by the current provider.
- Update, remove, digest-refresh, and autostart GraphQL methods remain unexposed by FolderView Plus UI.
- Native organizer queries and mutations remain detect-only and are never invoked.

A schema field existing is necessary but not sufficient to expose a persistent or destructive mutation. Such a feature needs its own isolated persistence, conflict, rollback, and failure fixtures plus explicit product approval.

## 7. Validate failures and lifecycle cleanup

Confirm:

- Authentication, permission, unavailable capability, and missing-fetch failures permanently disable the API path for that page lifecycle.
- Rate limits, service failures, timeouts, empty responses, and other transient failures use 15, 30, 60, 120, then 300 second cooldowns.
- A successful recheck clears failure state.
- Only one coordinator request is in flight.
- Navigation and `pagehide` abort active requests, close subscriptions, cancel reconnect, and reject stale results.
- Repeated Docker, Settings, and Dashboard navigation creates no duplicate handlers, observers, timers, requests, or rows.

## 8. Validate native coexistence

Against `future-native-host` and `future-docker-host.html`, confirm:

1. The native Docker component renders without a FolderView Plus fatal banner.
2. FolderView Plus adds no legacy table, folder row, action bar, context menu, observer, or host-hook wrapper.
3. Native folders remain controlled by Unraid and appear only once.
4. No FolderView Plus data is deleted, rewritten, or automatically migrated.
5. Settings, backups, diagnostics, rules, health, privacy, Dashboard, and VM surfaces remain available.

Any organizer migration requires a separately approved schema review, conflict model, backup/rollback design, explicit user confirmation, and isolated cross-version tests.

## 9. Validate diagnostics and privacy

Evidence may contain only:

- Host generation and aggregate page-shape booleans.
- API and Unraid versions when queryable.
- Query/mutation/subscription capability booleans.
- Selected provider, fallback state, and aggregate health counts.
- Coordinator state, source, last-success timestamp, failure category, failure count, cooldown, in-flight state, and structural-refresh state.
- Native organizer availability with the fixed `detect-only` policy.

It must never contain container, VM, or folder names/IDs; paths; IPs; URLs; labels; log content; CSRF values; cookies; tokens; GraphQL variables; raw schema responses; or raw server errors.

## 10. Run qualification

```bash
node --test tests/docker-runtime-api-coordinator.test.mjs tests/unraid-api-fixtures.test.mjs tests/unraid-docker-future-compatibility.test.mjs tests/unraid-upstream-monitor.test.mjs tests/unraid-compatibility-monitor.test.mjs tests/community-applications-guard.test.mjs
sh scripts/php_runtime_compatibility.sh
bash scripts/run_ci_suite.sh --lane lint --lane tests
bash scripts/run_ci_suite.sh --lane workflow-tests --lane workflow-guards --lane docs-guards
bash scripts/run_ci_suite.sh --lane fixture-browser
bash scripts/run_ci_suite.sh --lane browser-smoke
bash scripts/run_ci_suite.sh --lane theme-matrix
npm run test:runtime-performance
bash scripts/release_guard.sh
bash scripts/install_smoke.sh
```

`browser-smoke` is a deterministic Chromium fixture profile. `theme-matrix` runs the same local inventory across Chromium, Firefox, WebKit, light/dark color schemes, and desktop/smartphone viewports. Scheduled validation uses the isolated fixture suite and has no live-system secrets.

## 11. Make the release decision

Keep native Docker-page ownership with Unraid unless all of these are true:

- Unraid has activated and documented the replacement.
- The required schema and permissions are public and stable.
- Upstream review and the full isolated matrix pass.
- Folder ownership and migration behavior have explicit product decisions.
- Reproducible rollback preserves FolderView Plus and native organizer data.
- Sanitized aggregate evidence is sufficient to diagnose failures.

Until then, safe coexistence remains the supported policy and FolderView Plus continues on unaffected legacy Docker, Dashboard, VM, Settings, backup, and diagnostics surfaces.
