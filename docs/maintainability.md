# Maintainability Controls

FolderView Plus uses ratcheted checks so maintenance improvements cannot silently regress as the plugin grows.

## Architecture boundaries

- The Settings page loads a small foundation stage before deferring the remaining workspace modules to an idle or first-interaction opportunity. `folderviewplus.settings-loader.js` preserves dependency order and reports module-load failures through the fatal Settings diagnostics surface.
- `schemas/architecture-contracts.schema.json` caps browser globals, inline page actions, and the line counts of the largest legacy files. New behavior should be extracted into focused modules instead of increasing those budgets.
- Remote theme-workspace retrieval is isolated in `server/lib.remote.php`. It enforces HTTPS, allowlisted redirect hosts, redirect limits, response-size limits, and bounded timeouts before content reaches the main server library.
- The PHPStan lane initially covers this extracted remote-input boundary. The existing PHP syntax and unused-helper scans continue to cover the complete server tree; expand PHPStan paths as additional Unraid host dependencies receive analysis stubs.

## Release integrity

- Dev versions are allocated above versions visible in the archive, manifests, branch history, and version tags.
- Historical reproducibility checks use `FVPLUS_HISTORICAL_REBUILD=1` only inside isolated guard worktrees.
- Main-to-dev back-merges build a fresh dev package from merged source; packaged/source drift is never bypassed.
- Stable release preparation fails closed unless the configured Unraid version matrix, browser smoke target, and black/white theme matrix can run.
- Release notes include source commit, archive SHA-256, previous stable tag, a full comparison URL, and bounded commit history.
- Remote publication validation downloads and hashes the archive bytes. Its retry messages distinguish stale manifests, unavailable artifacts, stale checksum files, and stale archive content.

## Supply chain and dependencies

- All third-party GitHub Actions are pinned to immutable full commit SHAs with a readable major-version comment.
- `scripts/action_pin_guard.mjs` rejects mutable references.
- Dependabot proposes grouped weekly npm and GitHub Actions updates. jQuery major upgrades remain deliberate because Unraid host compatibility must be reviewed.
- `docs/sbom.cdx.json` is a generated CycloneDX inventory of npm development tools and GitHub Actions. Run `npm run sbom` after dependency or action changes; CI uses `npm run sbom:check`.
- PHPStan is downloaded at a pinned version and SHA-256 by `scripts/phpstan_guard.sh`; it is development-only and is never shipped in the plugin archive.

## UI, localization, and diagnostics

- Deterministic browser fixtures run Axe WCAG 2 A/AA/2.1 AA checks after every scenario and retain artifacts in CI.
- Browser fixtures exercise desktop/mobile layout, black/white themes, keyboard behavior, reduced-motion-safe interactions, privacy persistence, and diagnostics rendering.
- Coverage thresholds are enforced with c8 for the shared preferences, view-settings, and sanitized comparator modules.
- The pseudo-localization runtime and browser smoke cover expanded `en-XA` and RTL `ar-XB` states.
- `scripts/i18n_migration_budget_guard.mjs` prevents growth of auto-bound `legacy.surface.*` keys and prevents loss of semantic keys.
- `npm run compare:support-bundles -- <before.json> <after.json>` compares only allowlisted, sanitized diagnostic fields and refuses full or unmanifested bundles.

## Operational review

- The scheduled Unraid Docker monitor opens or updates one deduplicated GitHub issue when the upstream interface leaves its dormant state.
- Follow [Unraid Docker prerelease qualification](unraid-docker-prerelease-qualification.md) before changing native-page safe mode.
- Audit current and reachable package history with `bash scripts/artifact_history_audit.sh` and `bash scripts/artifact_history_audit.sh --history`.
- Follow [artifact retention](artifact-retention.md) before any coordinated Git LFS or history migration. History rewriting is intentionally never automated.
- Architectural decisions and invariants are recorded under [`docs/adr/`](adr/).
