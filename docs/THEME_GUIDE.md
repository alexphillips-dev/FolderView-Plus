# FolderView Plus Theme Guide

## Overview
FolderView Plus supports custom CSS and JavaScript extensions on Docker, VM, and Dashboard pages.

Versioned compatibility contract:

- `docs/THEME_API_CONTRACT.md`

Custom extension directories:

- CSS: `/boot/config/plugins/folderview.plus/styles/`
- JS: `/boot/config/plugins/folderview.plus/scripts/`

Legacy override roots are also supported (`folder.view`, `folder.view2`, `folder.view3`) for migration compatibility.

## Settings workspaces

Open **Settings → FolderView Plus → Advanced → Themes** to see the active host theme and manage imported GitHub CSS themes. Aurora is identified from its enabled color stylesheet, including when its page enhancements are disabled. If Aurora is switched off for the browser or its colors are disabled, the status falls back to the native Unraid theme. The separate **Active managed theme** card and managed-theme count describe only themes imported into FolderView Plus. Installed host themes remain managed through Unraid.

The **Appearance** tab below Themes contains the **Customization layer**: profiles, global and page scopes, color presets, token controls, preview and custom CSS. Switching between these tabs preserves the current customization draft. Save customization changes in Appearance; activate, update, disable or delete imported themes in Themes. Both tabs display operation feedback.

Themes also reports **Host identity source**, **Theme adaptation** and **Control sizing**. A declared or recognized name is separate from whether colors were inherited through CSS variables or native computed styles. An unidentified theme can be adapted successfully. "Unraid base theme" describes the reported native base, even when an unnamed custom stylesheet changes its appearance. Recovery statuses explain whether the selected mode, host contrast or missing inputs caused the plugin palette to be used.

Saved color tokens apply to Docker, VMs and Dashboard in Auto and Host modes. The generated stylesheet includes separate customization inputs so repeated host-theme resolution preserves those choices. Removing a customization restores the surrounding theme; Safe and High Contrast modes retain their recovery colors. Existing profiles and exports keep the same data format.

## File Naming
Use `name.tab.ext` where:

- `name`: any prefix/name
- `tab`: `docker`, `vm`, `dashboard` (can chain with `-`)
- `ext`: `.css` or `.js`

Examples:

- `mytheme.docker.css`
- `mytheme.vm.js`
- `mytheme.dashboard-docker.css`

Disable a file without deleting it:

- `mytheme.docker.css.disabled`

## Runtime Theme Tokens

Auto and Host compatibility modes can follow the active webGUI theme without a custom override file. The resolver reads host color variables or, when that contract is absent, usable native computed styles. Buttons can follow native typography, padding, radius and height. Stylesheet, font and theme changes update controls, menus and surfaces; CSSOM changes need the documented refresh event. Safe and High Contrast modes keep recovery palettes; explicit per-folder status colors are retained. See [Host Palette Inputs](THEME_API_CONTRACT.md#host-palette-inputs) and [Compatibility](COMPATIBILITY.md#custom-themes) for renderer ownership restrictions.

Primary runtime tokens:

- `--fvplus-status-started`
- `--fvplus-status-paused`
- `--fvplus-status-stopped`
- `--fvplus-graph-cpu`
- `--fvplus-graph-mem`
- `--fvplus-surface-tint`
- `--fvplus-hover-bg`
- `--fvplus-border`

Per-folder optional status overrides (set automatically by runtime when custom colors are configured):

- `--fvplus-folder-status-started`
- `--fvplus-folder-status-paused`
- `--fvplus-folder-status-stopped`

Legacy graph aliases remain supported:

- `--folder-view3-graph-cpu`
- `--folder-view3-graph-mem`

## Started State Theme Awareness
Started status now follows active theme text color by default through `--fvplus-status-started`.

- Dark themes: started text/icons render light.
- Light themes: started text/icons render dark.
- If a folder has a custom started color configured, that custom value is applied for that folder only.

## Runtime Selector Contract
Stable runtime selectors for custom themes:

- `td.ct-name.folder-name`
- `div.folder-name-sub`
- `button.dropDown-*` + `.folder-dropdown`
- `td.updatecolumn.folder-update`
- `div.folder-preview`
- `img.img.folder-img`
- `span.state.folder-state`
- `.preview-outbox`, `.action-info`, `.info-ct`, `.tooltipster-docker-folder`

## Loader Security
Custom CSS/JS loaders resolve and validate each file path against the configured base override directory before loading.

This blocks path traversal via symlinks or unexpected paths.

## Recommendations
- Prefer CSS variables over `!important`.
- Scope overrides to Docker/VM/Dashboard roots where possible.
- Keep status color overrides for semantic exceptions, not broad theme foundations.
- Use **Theme diagnostics** in settings to verify resolved token values after switching themes.

## Maintainer integration fixture

The synthetic example in `tests/browser/fixtures/themes/maintainer-theme.js` declares a display name, supplies host variables, sends the CSSOM refresh event and removes its listeners and metadata when disabled. It deliberately leaves rows and native hooks under their existing ownership. Its `/plugin/scripts/` selector is for the isolated fixture server; production integrations must recognize `/plugins/folderview.plus/` and their own disabled state as described in the [layout ownership contract](THEME_API_CONTRACT.md#layout-ownership-for-theme-integrations).

Run the example with the actual plugin lifecycle modules in an isolated local browser fixture:

```bash
FVPLUS_FIXTURE_PROFILE=host-maintainer npm run test:browser-fixtures
```

The `before` and `after` cases test both script load orders. They retain stored member nodes and parentage, open native menus, stop/start/pause/resume through the existing lifecycle bridge, and verify no stuck spinner, host reload or native hook replacement after theme removal. Use this as a starting point for testing a real enhancer's opt-out behavior, not as certification of a third-party theme.

The `host-matrix` profile covers eight explicit synthetic contracts (dark/light variables, direct CSS, legacy variables, modern colors, transparency, doubled base text size and mixed/stale metadata). `host-accessibility` checks real page actions and shared controls in normal, hover, selected, disabled and keyboard-focus states. Chromium and Firefox exercise forced-color rendering; WebKit uses the plugin's High Contrast recovery when its emulation is unavailable. `host-lifecycle` covers stylesheet and font changes plus teardown/rebind. All run against Docker, VM, Dashboard, Settings and editor fixtures where applicable. These fixtures do not operate a real Unraid host.
