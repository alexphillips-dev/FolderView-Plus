# FolderView Plus Theme Guide

## Overview
FolderView Plus supports custom CSS and JavaScript extensions on Docker, VM, and Dashboard pages.

Versioned compatibility contract:

- `docs/THEME_API_CONTRACT.md`

Custom extension directories:

- CSS: `/boot/config/plugins/folderview.plus/styles/`
- JS: `/boot/config/plugins/folderview.plus/scripts/`

Legacy override roots are also supported (`folder.view`, `folder.view2`, `folder.view3`) for migration compatibility.

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
