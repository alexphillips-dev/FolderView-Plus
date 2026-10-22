# Theme API Contract

Contract version: `1.1.0`
Effective date: `2026-10-22`

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

## Host Palette Inputs

In Auto and Host compatibility modes the shared resolver reads these host variables before legacy aliases:

| Purpose | Host input |
| --- | --- |
| Page and card surfaces | `--background-color`, `--table-background-color` (or `--dashboard-background-color`) |
| Text and secondary text | `--text-color`, `--alt-text-color` |
| Accent | `--link-text-color`, then `--brand-orange`, `--accent`, `--orange` |
| Border and inset surface | `--table-border-color` or `--border-color`, `--mild-background-color` |
| Inputs and buttons | `--input-bg-color`, `--button-background`, `--hover-button-background` |
| Optional control radius | `--button-border-radius`, or Aurora's `--tp-r-full` |

Both page and card colors must be usable before host surfaces replace the fallback chrome. Invalid colors, unresolved variables and gradients are skipped as color inputs. Modern CSS colors are normalized by the browser. Host inputs are never written by FolderView Plus.

The resolved palette supplies existing runtime, Settings, editor, Dashboard and menu tokens. The additive `--fvplus-ui-control-radius` output controls supported button corners. `--fvplus-control-accent-text` supplies readable toolbar text when the accent itself has insufficient contrast against an accent-tinted surface; borders and backgrounds retain the resolved accent.

`data-fv-theme-source="host"` on resolver targets identifies an applied host palette. `fallback` means the normal fallback or safety palette is active. Safe and High Contrast modes retain their recovery behavior. Removing host inputs clears previous host overrides on the next theme reflow. Explicit per-folder status colors retain precedence.

## Layout Ownership for Theme Integrations

Palette support does not authorize a theme to reorganize FolderView Plus folders. A theme that enhances the native Docker table or Dashboard must coordinate ownership separately:

- Recognize the installed plugin directory `/usr/local/emhttp/plugins/folderview.plus/` and browser assets under `/plugins/folderview.plus/` independently of legacy `folder.view*` plugins.
- With FolderView Plus active, retain the theme's palette/navigation but skip competing compact-grid conversion, container grouping, filtering, row movement, forced sorting and folder-click interception on its Docker/Dashboard surfaces.
- Leave `.folder-storage` descendants under FolderView Plus ownership. A descendant search for native container cells also finds stored members; moving those results to the top-level table breaks collapsed folders.
- Keep the configured folder/member order and nested hierarchy. Do not impose alphabetical order as a compatibility adaptation.
- Do not replace `listview`, `loadlist`, their `_original` aliases, or FolderView Plus's request/refresh handling. Preserve native container actions through the installed FolderView Plus lifecycle bridge.
- Reload the page when changing the owning renderer. Do not write another plugin's settings or migrate its folder data to implement a view switch.

The existing Docker host decision is available as `window.FolderViewPlusDockerHostCompatibilityDecision`, with sanitized updates delivered by the `folderviewplus:docker-host-compatibility` event. This describes FolderView Plus's host decision; it is not an API for a theme to seize ownership. Themes should also recognize their own disabled state and test both script load orders.

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
