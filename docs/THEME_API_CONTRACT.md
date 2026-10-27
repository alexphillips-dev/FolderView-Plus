# Theme API Contract

Contract version: `1.2.0`
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
Theme changes trigger a shared, debounced document subscription. It covers class/style/theme attributes, stylesheet insertion/removal and load/error, link href/disabled/media changes, style text edits, completed font loading, viewport changes, color scheme, contrast preference and OS forced colors. Reflow runs on:
- Docker runtime layout sizing
- VM runtime layout sizing
- Dashboard layout rails
- Settings table and overflow guards

Subscriptions disconnect on teardown and suspend during page hiding; retained subscriptions reconnect on restoration. No polling or browser prototype patches are installed. CSSOM-only changes such as `insertRule()`, `replaceSync()` or adopted stylesheet replacement must dispatch `window.dispatchEvent(new Event('folderviewplus:theme-change'))` after the change is ready. This is a refresh notification, not a renderer ownership switch.

## Host Palette Inputs

In Auto and Host compatibility modes the shared resolver reads these host variables before legacy aliases:

| Purpose | Host input |
| --- | --- |
| Page and card surfaces | `--background-color`, `--table-background-color` (or `--dashboard-background-color`) |
| Text and secondary text | `--text-color`, `--alt-text-color` |
| Accent | `--link-text-color`, then `--brand-orange`, `--accent`, `--orange` |
| Border and inset surface | `--table-border-color` or `--border-color`, `--mild-background-color` |
| Inputs and buttons | `--input-bg-color`, `--button-background`, `--hover-button-background` |
| Optional input/button foregrounds | `--input-text-color`, `--button-text-color` (otherwise `--text-color`) |
| Optional control radius | `--button-border-radius`, or Aurora's `--tp-r-full` |

Both page and card colors must be usable before host surfaces replace the fallback chrome. Invalid colors, unresolved variables and gradients are skipped as color inputs. Modern CSS colors are normalized by the browser. Host inputs are never written by FolderView Plus.

When none of the page/card variable contracts are declared, Auto and Host can sample computed native surfaces, controls, fields and links instead. Sampling excludes plugin-owned elements and requires an opaque page color and usable native controls or surfaces. A defined but invalid variable contract retains recovery behavior. Gradients, images, arbitrary DOM replacements and competing renderers cannot be inferred from colors.

Native button typography, padding, radius and height are sampled without relying on a theme name. Optional `data-fvplus-theme-native="button"`, `"surface"` and `"link"` markers identify suitable native samples; do not put them on plugin controls. Output metrics use `--fvplus-host-control-{font-family,font-size,font-weight,line-height,letter-spacing,text-transform,padding,radius,height}`. Icon controls keep their own geometry; desktop controls retain the 30px floor and existing touch rules still apply. Missing native samples clear previous metrics.

The additive `--fvplus-ui-{card-fg,input-fg,control-fg,control-hover-fg,control-active-fg,control-active}` outputs pair foregrounds with their actual surfaces and states. Contrast checks composite translucent colors before choosing a readable foreground. OS forced colors use system colors and preserve borders, selected/disabled states and keyboard focus; the browser remains free to adjust colors.

The resolved palette supplies existing runtime, Settings, editor, Dashboard and menu tokens. The additive `--fvplus-ui-control-radius` output controls supported button corners. `--fvplus-control-accent-text` supplies readable toolbar text when the accent itself has insufficient contrast against an accent-tinted surface; borders and backgrounds retain the resolved accent.

Managed customization assets also emit `--fvplus-custom-theme-accent`, `--fvplus-custom-theme-surface-panel`, `--fvplus-custom-theme-border-subtle`, and `--fvplus-custom-status-{started,paused,stopped}` as resolver inputs. These are derived from the existing profile variables and are never written by the resolver. Auto and Host modes apply these inputs over the host palette, subject to the existing contrast checks; Safe and High Contrast use their recovery palettes. This separates saved customization from resolved output and prevents either stale output feedback or a later resolver pass from erasing the saved layer. Graph tokens continue to be consumed directly from the generated stylesheet.

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

See [Maintainer integration fixture](THEME_GUIDE.md#maintainer-integration-fixture) for a reproducible palette-only example with both load orders, stored rows, native menus and lifecycle actions.

## Theme Identity and Adaptation

An active theme may declare `data-fvplus-theme-name` on `html` (or `body`). Remove the attribute when disabling its colors. This escaped display label is separate from palette detection and never grants layout ownership. Aurora retains its enabled same-origin stylesheet recognition. Without a declared or recognized identity, Unraid's reported name describes the base theme; otherwise the UI says "Unidentified host theme". Unknown identity does not prevent palette adaptation. Do not derive a theme name from arbitrary stylesheet URLs or infer it from colors.

Themes displays identity source, palette adaptation and control sizing separately from imported managed themes. The resolver snapshot's additive `hostIntegration` contains `identitySource` (`declared`, `recognized`, `native-base`, `unknown`), `paletteSource` (`variables`, `computed`, `fallback`, `system`), `reason` (`none`, `forced-colors`, `requested-recovery`, `contrast-recovery`, `missing-host-inputs`) and, after application, `nativeControls` (boolean).

## Diagnostics Contract
Theme diagnostics are exposed through the Settings diagnostics action `runThemeDiagnostics()` and the Theme summary card's technical details.

Local diagnostics retain resolved token values, selector samples and loaded plugin assets. Sanitized support bundles instead project canonical adaptation enums, bounded numeric contrast/status checks and warning/adjustment codes. They omit host names, raw CSS/token values, class lists, attributes and asset URLs. Full bundles retain detailed local evidence under the existing explicit full-privacy mode. Unknown fields and arbitrary check names do not enter sanitized theme exports.

## Guard Rails
Contract regressions are blocked by:
- `scripts/theme_runtime_guard.sh`
- `tests/runtime-theme-token-guard.test.mjs`
- `tests/theme-integration.test.mjs` and `tests/host-theme-resolver.test.mjs`
- Host theme matrix, accessibility and maintainer browser profiles, plus support-bundle privacy tests
