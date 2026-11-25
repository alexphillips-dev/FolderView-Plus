# Maintainability Controls

FolderView Plus uses ratcheted checks so maintenance improvements cannot silently regress as the plugin grows.

## Architecture boundaries

- The Settings page loads a small foundation stage before deferring the remaining workspace modules to an idle or first-interaction opportunity. `folderviewplus.settings-loader.js` preserves dependency order, records bounded per-module timing and outcomes, enforces a module timeout, and can resume once at the failed module without duplicating completed modules.
- Settings, Docker, VMs, Dashboard plugin content, and Folder Editor bootstrap paths emit the same versioned startup-incident contract. The shared fatal surface keeps technical evidence behind a plain-language, accessible presentation; Dashboard errors remain scoped to FolderView Plus content and never replace the host Dashboard.
- `schemas/architecture-contracts.schema.json` caps browser globals, inline page actions, and the line counts of the largest legacy files. New behavior should be extracted into focused modules instead of increasing those budgets.
- Remote theme-workspace retrieval is isolated in `server/lib.remote.php`. It enforces HTTPS, allowlisted redirect hosts, redirect limits, response-size limits, and bounded timeouts before content reaches the main server library.
- The PHPStan lane runs at level 2 across the extracted remote-input, validation, and API-contract libraries, with the localization registry loaded for shared symbols. The existing PHP syntax and unused-helper scans continue to cover the complete server tree; expand PHPStan paths as additional Unraid host dependencies receive analysis stubs.

## Release integrity

- Dev versions are allocated above versions visible in the archive, manifests, branch history, and version tags.
- Historical reproducibility checks use `FVPLUS_HISTORICAL_REBUILD=1` only inside isolated guard worktrees.
- Main-to-dev back-merges build a fresh dev package from merged source; packaged/source drift is never bypassed.
- Release-mode validation fails closed unless the isolated Unraid fixture profiles, browser smoke fixtures, and black/white theme matrix can run. Repository validation never accepts a live Unraid URL, session, cookie, or credential.
- Release notes include source commit, archive SHA-256, previous stable tag, and a full comparison URL alongside curated user-facing changes; they never embed raw commit history.
- Remote publication validation downloads and hashes the archive bytes. Its retry messages distinguish stale manifests, unavailable artifacts, stale checksum files, and stale archive content.

## Supply chain and dependencies

- All third-party GitHub Actions are pinned to immutable full commit SHAs with a readable major-version comment.
- `scripts/action_pin_guard.mjs` rejects mutable references.
- Dependabot proposes grouped weekly npm and GitHub Actions updates. jQuery major upgrades remain deliberate because Unraid host compatibility must be reviewed.
- `docs/sbom.cdx.json` is a generated CycloneDX inventory of shipped browser libraries, Unraid-provided runtime contracts, npm development tools, and GitHub Actions. `scripts/runtime_components.json` is the canonical runtime inventory and classifies every file under `scripts/include`; run `npm run sbom` after runtime dependency, npm, or action changes. CI uses `npm run sbom:check`.
- `.github/workflows/dependency-vulnerability-scan.yml` scans that generated inventory against OSV every Wednesday and on demand. Versioned components with supported package identifiers are evaluated for known vulnerabilities; SARIF is retained and published to GitHub code scanning, and a reported vulnerability fails the job for review. Inventory entries without a usable package identifier remain visible for manual upstream review rather than being silently treated as scanned.
- Repository Actions policy permits only GitHub-owned actions plus the SHA-pinned `github/codeql-action@*`, `ossf/scorecard-action@*`, and `google/osv-scanner-action/*@*` patterns needed by the security workflows. Verified-publisher actions are not enabled globally.
- PHPStan is downloaded at a pinned version and SHA-256 by `scripts/phpstan_guard.sh`; it is development-only and is never shipped in the plugin archive.

## UI, localization, and diagnostics

- Deterministic browser fixtures run Axe WCAG 2 A/AA/2.1 AA checks after every scenario and retain artifacts in CI.
- Browser fixtures exercise desktop/mobile layout, black/white themes, keyboard behavior, reduced-motion-safe interactions, privacy persistence, and diagnostics rendering.
- Coverage thresholds are enforced with c8 across shared preferences, view settings, diagnostics view models, Docker container normalization, Docker layout geometry, future-host compatibility, and the sanitized support-bundle comparator.
- The pseudo-localization runtime and browser smoke cover expanded `en-XA` and RTL `ar-XB` states.
- `scripts/i18n_migration_budget_guard.mjs` prevents growth of auto-bound `legacy.surface.*` keys and prevents loss of semantic keys.
- `npm run compare:support-bundles -- <before.json> <after.json>` compares only allowlisted, sanitized diagnostic fields and refuses full or unmanifested bundles.
- Startup incidents persist in session storage for at most 24 hours, remain sanitized before persistence, and enter support bundles through the normal UI-telemetry redactor. Recovery attempts are bounded and recorded so reloads do not erase the evidence that support needs.

## Operational review

- The Unraid compatibility monitor and scheduled workflow health watchdog are retired. Their GitHub workflows are disabled and removed from `dev`; they no longer create or update issues. The workflow self-check rejects restoration of either workflow file.
- Compatibility review is manual. `scripts/unraid_docker_upstream_monitor.sh`, `scripts/unraid_compatibility_monitor.mjs`, and `scripts/community_applications_guard.mjs` remain available for explicit review of public upstream inputs without issue automation.
- `docs/unraid-compatibility-baseline.json` records human-reviewed upstream versions and Git blob signatures. Review tools report drift but never modify or approve the baseline.
- Run `scripts/php_runtime_compatibility.sh` manually in isolated PHP profiles for the supported Unraid releases. It syntax-checks every shipped PHP file and runs a request-authority smoke contract without connecting to a server. The retired monitor no longer schedules the PHP profile matrix.
- The installer recovery fixture runs the manifest hook with synthetic boot archives and failure injection. Fetch the pinned CLI source for [Unraid 7.0.0](https://raw.githubusercontent.com/unraid/webgui/71a85f020b9b1bce48b5bec75d69d78a57d8df3d/emhttp/plugins/dynamix.plugin.manager/scripts/plugin) or [Unraid 7.4.0](https://raw.githubusercontent.com/unraid/webgui/b135287c706a30da44f71cc7820615209e83e9a0/emhttp/plugins/dynamix.plugin.manager/scripts/plugin) and set `FVPLUS_TEST_UNRAID_PLUGIN_CLI` to its absolute Linux path when running `node --test tests/install-upgrade-recovery.test.mjs`. The fixture verifies the source hash and runs update, manual reinstall, and offline boot with temporary paths and simulated package operations.
- The fixture coordinates competing native operations around the final version and boot manifest writes. Staged URL installs and updates retain the verified candidate for a one-time native post-hook, which confirms the running version and reconciles the boot manifest after Unraid's final copy. A newer update check remains staged for a separate update. The native CLI manages its own status output and exit code. FolderView Plus reports completion after its post-hook verifies registration.
- The [Unraid 7.4.0 browser fixture](#run-the-pinned-unraid-browser-fixture) loads the pinned native Docker, VM, and Dashboard pages with the same synthetic Docker and libvirt data across stock, Plus, and uninstalled states.
- Community Applications validation uses the official public portal guidance, starter repository, catalog feed, and canonical template. The authenticated portal Validate/Scan session is never stored in GitHub Actions.
- The scheduled validation workflow runs deterministic fixtures in Chromium, Firefox, and WebKit every Monday. It does not connect to live Unraid targets or require live-system repository secrets.
- Review scheduled workflow results directly in GitHub Actions when needed; there is no separate freshness monitor or recovery-issue automation.
- Follow [Unraid Docker prerelease qualification](unraid-docker-prerelease-qualification.md) before changing native-page safe mode.
- Audit current and reachable package history with `bash scripts/artifact_history_audit.sh` and `bash scripts/artifact_history_audit.sh --history`.
- Follow [artifact retention](artifact-retention.md) before any coordinated Git LFS or history migration. History rewriting is intentionally never automated.
- Architectural decisions and invariants are recorded under [`docs/adr/`](adr/).

### Run the pinned Unraid browser fixture

Run these commands from the repository root on Linux or WSL with unprivileged user, mount, PID and network namespaces enabled. The fixture uses Bash, util-linux, iproute2, cURL, PHP CLI with `mbstring`, `curl`, SQLite and SimpleXML, and the repository's Playwright Chromium. It verifies both archives before extraction and serves requests over loopback inside a fresh network namespace.

```sh
mkdir -p tmp/unraid-synthetic-input
curl --fail --location --output tmp/unraid-synthetic-input/webgui.tar.gz https://codeload.github.com/unraid/webgui/tar.gz/b135287c706a30da44f71cc7820615209e83e9a0
curl --fail --location --output tmp/unraid-synthetic-input/folderview3.tar.gz https://codeload.github.com/chodeus/folder.view3/tar.gz/09842a3f2c8938db005200168f8fd0186c88426e
bash scripts/verify_unraid_webgui.sh tmp/unraid-synthetic-input/webgui.tar.gz tmp/unraid-synthetic-input/folderview3.tar.gz
```

The browser opens the Docker runtime preview on demand, verifies Docker and VM tiles can finish independently, saves container order through Unraid's handler, reloads the page, and verifies the saved order and autostart survive the native plugin manager's uninstall. Slackware package removal and cron updates use fixture commands. The synthetic host omits the optional stock Dashboard CPU telemetry service. Qualification of a live Unraid host remains manual.

For Linux distributions that supply PHP extensions as separate packages, `FVPLUS_TEST_PHP_MODULE_DIR` can point to matching extracted `mbstring.so`, `curl.so`, `sqlite3.so`, `pdo_sqlite.so`, and `libonig.so.5` files.
