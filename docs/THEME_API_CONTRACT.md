# Theme API Contract

Contract version: `1.0.0`  
Effective date: `2026-03-19`

This document defines the stable theming hooks for FolderView Plus custom themes.

## Stability Policy
- Patch releases: no breaking changes to documented tokens/selectors.
- Minor releases: additive only (new tokens/selectors may be added).
- Breaking removals/renames require:
  - deprecation notice in changelog and theme docs
  - compatibility bridge for at least two stable releases when feasible
  - update to this contract version (major bump)

## Runtime Tokens
Global runtime tokens:
- `--fvplus-theme-foreground`
- `--fvplus-status-started`
- `--fvplus-status-paused`
- `--fvplus-status-stopped`

Per-folder runtime override tokens:
- `--fvplus-folder-status-started`
- `--fvplus-folder-status-paused`
- `--fvplus-folder-status-stopped`

Graph tokens:
- `--fvplus-graph-cpu`
- `--fvplus-graph-mem`

Legacy graph aliases (still supported):
- `--folder-view3-graph-cpu`
- `--folder-view3-graph-mem`

Settings surface tokens:
- `--fvplus-settings-text-primary`
- `--fvplus-settings-text-muted`
- `--fvplus-settings-border-subtle`
- `--fvplus-settings-surface-muted`
- `--fvplus-settings-accent`

Dashboard quick-rail tokens:
- `--fvplus-dashboard-quick-action-border`
- `--fvplus-dashboard-quick-action-bg`
- `--fvplus-dashboard-quick-action-fg`
- `--fvplus-dashboard-accent`

## Stable Selectors
Status selectors:
- `span.folder-state.fv-folder-state-started`
- `span.folder-state.fv-folder-state-paused`
- `span.folder-state.fv-folder-state-stopped`
- `i.folder-load-status.started`
- `i.folder-load-status.paused`
- `i.folder-load-status.stopped`

Settings root scope:
- `#fv-settings-root`

Dashboard quick actions:
- `.fv-dashboard-layout-inline-host`
- `.fv-dashboard-layout-quick-rail`
- `.fv-dashboard-quick-action`

## Live Theme Reflow Contract
Theme changes (class/style/theme attribute updates and `prefers-color-scheme` changes) trigger deterministic reflow on:
- Docker runtime layout sizing
- VM runtime layout sizing
- Dashboard layout rails
- Settings table and overflow guards

Custom themes can rely on runtime repaint/reflow without manual refresh.

## Diagnostics Contract
Theme diagnostics output is exposed in settings diagnostics:
- button action: `runThemeDiagnostics()`
- output node: `#theme-diagnostics-output`

Diagnostics reports:
- resolved theme token values
- runtime selector samples
- loaded plugin stylesheet/script URLs
- warning hints for conflicting status colors

## Guard Rails
Contract regressions are blocked by:
- `scripts/theme_runtime_guard.sh`
- `tests/runtime-theme-token-guard.test.mjs`
