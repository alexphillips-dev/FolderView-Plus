# FolderView Plus

<p align="center">
  <img src="docs/images/banner.png" alt="FolderView Plus banner" />
</p>

<p align="center">
  <a href="https://github.com/alexphillips-dev/FolderView-Plus/actions/workflows/ci.yml"><img src="https://github.com/alexphillips-dev/FolderView-Plus/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/alexphillips-dev/FolderView-Plus/releases"><img src="https://img.shields.io/github/v/release/alexphillips-dev/FolderView-Plus?style=flat-square" alt="Latest Release"></a>
  <a href="https://github.com/alexphillips-dev/FolderView-Plus/releases"><img src="https://img.shields.io/github/release-date/alexphillips-dev/FolderView-Plus?style=flat-square" alt="Release Date"></a>
  <a href="https://unraid.net/"><img src="https://img.shields.io/badge/Unraid-7.0.0%2B-F15A2C?logo=unraid&logoColor=white&style=flat-square" alt="Unraid 7.0.0+"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/github/license/alexphillips-dev/FolderView-Plus?style=flat-square" alt="License: MIT"></a>
  <a href="https://github.com/alexphillips-dev/FolderView-Plus/issues"><img src="https://img.shields.io/github/issues/alexphillips-dev/FolderView-Plus?style=flat-square" alt="Open Issues"></a>
  <a href="https://github.com/alexphillips-dev/FolderView-Plus/commits/main"><img src="https://img.shields.io/github/last-commit/alexphillips-dev/FolderView-Plus/main?style=flat-square" alt="Last Commit"></a>
  <a href="https://buymeacoffee.com/alexphillipsdev"><img src="https://img.shields.io/badge/Sponsor-Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=000&style=flat-square" alt="Sponsor"></a>
</p>

FolderView Plus gives Unraid a cleaner, folder-first way to manage Docker containers and VMs.  
It is built for real libraries: easier organization, safer imports, faster recovery, and better day-to-day control.

Quick links: [Install](#install) | [Feature Highlights](#feature-highlights) | [Screenshots](#screenshots) | [Rules Quick Guide](#rules-quick-guide) | [Import, Export, and Backups](#import-export-and-backups) | [Troubleshooting](#troubleshooting) | [Edge Cases + Test Matrix](docs/edge-cases-test-matrix.md) | [Support](#support)

## Screenshots

<p align="center">
  <img src="docs/images/screenshots/docker-basic.png" alt="Docker basic settings view" width="48%" />
  <img src="docs/images/screenshots/vm-basic.png" alt="VM basic settings view" width="48%" />
</p>
<p align="center">
  <img src="docs/images/screenshots/wizard.png" alt="Setup wizard view" width="48%" />
  <img src="docs/images/screenshots/advanced.webp" alt="Advanced settings view" width="48%" />
</p>

## Why Install This
- Keep large Docker/VM setups readable with folder grouping in Docker, VMs, and Dashboard
- Recover faster with automatic backups, snapshot compare, and one-click restore
- Import safely with preview diff and selective apply before making changes
- Reduce manual work using regex/label-based assignment rules
- Manage everything from a modern settings flow that works on desktop and mobile

## Requirements
- Unraid `7.0.0+`

## Install
Unraid UI (`Plugins -> Install Plugin`) or CLI:

```bash
plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg
```

Dev (testing) install URL:

```bash
plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg
```

## Update
> [!WARNING]
> If update detection is cached, use a one-time commit URL install, then return to `main` updates.

- Preferred: `Plugins -> Check for Updates`
- Manual: rerun the same `plugin install` command

If update caching delays detection, install once from a commit URL:

```text
https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/<commit>/folderview.plus.plg
```

Then return to normal `main` updates.

Version format:

- Stable: `YYYY.MM.DD.UU`
- `UU` is zero-padded for reliable Unraid ordering

## Uninstall
> [!CAUTION]
> Removing the plugin deletes its plugin-managed config directory.

```bash
plugin remove folderview.plus
```

## Feature Highlights
### Organization and Control

- Folder views for Docker, VMs, and Dashboard
- Nested folders for Docker and VM organization with parent/child tree support
- Folder runtime actions (`Start`, `Stop`, `Pause`, `Resume`)
- Sort modes: created, manual, A-Z
- Reliable manual reordering with up/down controls
- Pinned folders and status/health/update visibility controls

### Automation and Scale

- Auto-assignment rules:
  - Docker: name regex + label/image/compose matching
  - VM: name regex
- Rule tester, simulator, and conflict inspector
- Bulk assignment for Docker and VMs
- Folder templates for faster reuse

### Safer Data Operations

- Import preview with `Merge`, `Replace`, `Skip existing`
- Per-type import presets and defaults
- Pretty-printed schema exports with metadata
- Automatic pre-import backup + restore latest
- Scheduled backups, snapshot compare, and rollback checkpoints
- Change history and one-click undo

### UX and Compatibility

- Built-in, third-party, and uploaded icon support
- Custom CSS/JS extension loading
- Full mobile/touch support
- Mobile basic-table optimization with compact columns and row action menu
- Modern browser support (Chrome, Edge, Firefox, Safari)

## Quick Start
1. Open `Settings -> FolderView Plus`.
2. Create folders in Docker and/or VM sections.
3. Choose sort mode and view options.
4. Save.
5. Confirm folder groups in Docker/VM tabs.

## Rules Quick Guide
1. Switch to `Advanced`.
2. Open `Auto-assignment rules`.
3. Choose folder, rule kind, and action (`Include`/`Exclude`).
4. Add rule, then save.
5. Use `Test rule priority` or `Simulate all items` to validate behavior.

## Import, Export, and Backups
Export files:

- Docker: `FolderView Plus Export.json`
- VM: `FolderView Plus Export VM.json`
- Single folder: `<FolderName>.json`

Export format:

- Pretty-printed JSON
- Includes `schemaVersion`, `pluginVersion`, `exportedAt`

Recommended import flow:

1. Export current config first.
2. Import and review preview diff.
3. Choose mode/preset.
4. Apply import.
5. Use `Restore latest backup` if needed.

## Troubleshooting

- Plugin settings page appears blank on a fresh install:
  - Refresh the browser once (`Ctrl+F5`), then open `Settings -> FolderView Plus` again.
  - If still blank, check browser console and share diagnostics from the plugin settings page.
- Folder rendering pauses with a safe-mode banner:
  - FolderView Plus auto-detects conflicting FolderView runtimes.
  - Keep FolderView Plus installed and remove the detected conflicting runtime plugin.
  - Reload Unraid UI after plugin changes.
- Updates do not appear immediately:
  - Run `Plugins -> Check for Updates`.
  - If still cached, install once from a commit URL, then return to `main` updates.
- Import fails validation:
  - Confirm Docker exports are imported into Docker and VM exports into VMs.
  - Re-export with the latest plugin version if the source file was created by older tooling.

## Security and Reliability
- Request token and guarded endpoint protections
- Safer dynamic rendering to reduce XSS risk
- Automated regression checks (including mobile and release guards)

## Browser Support
Supported current major browsers:

- Chrome
- Edge (Chromium)
- Firefox
- Safari (macOS + iOS)

Not supported:

- Internet Explorer 11
- Legacy Edge (EdgeHTML)

## Paths
- Config root: `/boot/config/plugins/folderview.plus`
- Custom CSS: `/boot/config/plugins/folderview.plus/styles`
- Custom JS: `/boot/config/plugins/folderview.plus/scripts`
- Third-party icons: `/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons`
- User-uploaded icons: `/usr/local/emhttp/plugins/folderview.plus/images/custom`

## Theme Development
- Full theme guide: `docs/THEME_GUIDE.md`
- Versioned theme API contract: `docs/THEME_API_CONTRACT.md`
- Runtime status colors are CSS-variable driven:
  - `--fvplus-status-started` (theme-aware, follows current text color)
  - `--fvplus-status-paused`
  - `--fvplus-status-stopped`
- Legacy graph aliases remain supported:
  - `--folder-view3-graph-cpu`
  - `--folder-view3-graph-mem`
- Canonical graph variables:
  - `--fvplus-graph-cpu`
  - `--fvplus-graph-mem`
- Settings diagnostics includes **Theme diagnostics** to inspect resolved tokens and runtime selector state.

## Legacy CSS/JS Migration (FolderView2/3)
FolderView Plus keeps legacy override directory support so older custom tweaks can continue working.

Supported legacy override roots:

- `/boot/config/plugins/folder.view/styles`
- `/boot/config/plugins/folder.view2/styles`
- `/boot/config/plugins/folder.view3/styles`
- `/boot/config/plugins/folder.view/scripts`
- `/boot/config/plugins/folder.view2/scripts`
- `/boot/config/plugins/folder.view3/scripts`

File naming rules:

- Docker page overrides: `*.docker.css` and `*.docker.js`
- VM page overrides: `*.vm.css` and `*.vm.js`
- Dashboard overrides: `*.dashboard.css` and `*.dashboard.js`
- Disable any override file by appending `.disabled`

Legacy Docker selector compatibility contract (stable hooks):

- `td.ct-name.folder-name`
- `div.folder-name-sub`
- `button.dropDown-*` + `.folder-dropdown`
- `td.updatecolumn.folder-update`
- `div.folder-preview`
- `img.img.folder-img`
- `span.state.folder-state`
- Tooltip hooks: `.preview-outbox`, `.action-info`, `.info-ct`, `.tooltipster-docker-folder`

Full compatibility/deprecation policy:

- `SUPPORT_POLICY.md`

Example:

- `hernando.docker.css` works as a Docker override and can stay in a legacy `folder.view*/styles` directory.

Recommended migration path (optional but preferred):

1. Copy your legacy overrides into `/boot/config/plugins/folderview.plus/styles` and `/boot/config/plugins/folderview.plus/scripts`.
2. Keep the same filenames (for example, `hernando.docker.css`).
3. Hard-refresh the browser after save (`Ctrl+F5`) so CSS cache is rebuilt.

## Included Icon Pack Credits
- https://github.com/sameerasw/folder-icons
- https://github.com/hernandito/unRAID-Docker-Folder-Animated-Icons---Alternate-Colors

## Development
- Runtime source: `src/folderview.plus/`
- Manifest: `folderview.plus.plg`
- Archives: `archive/`

Build package:

```bash
bash pkg_build.sh
```

Prepare release (build + checks):

```bash
bash scripts/release_prepare.sh
```

Run tests:

```bash
node --test tests/*.mjs
```

## Support
- Forum support thread: https://forums.unraid.net/topic/197631-plugin-folderview-plus/
- Issues (GitHub forms): https://github.com/alexphillips-dev/FolderView-Plus/issues

## Sponsor
> [!TIP]
> If the plugin helps you, support ongoing development here:
> https://buymeacoffee.com/alexphillipsdev

## Credits
- [chodeus](https://github.com/chodeus/folder.view3) - FolderView Plus is built on the strong foundation of folder.view3. Thank you for the original architecture and groundwork.
- [sameerasw](https://github.com/sameerasw/folder-icons) and [hernandito](https://github.com/hernandito/unRAID-Docker-Folder-Animated-Icons---Alternate-Colors) - Thank you for creating and sharing icon packs that improve local icon workflows.

## License
See `LICENSE.md`.
