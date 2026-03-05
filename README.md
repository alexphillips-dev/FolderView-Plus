# FolderView Plus

[![Unraid 7.0.0+](https://img.shields.io/badge/Unraid-7.0.0%2B-F15A2C?logo=unraid&logoColor=white)](https://unraid.net/)
[![License: MIT](https://img.shields.io/github/license/alexphillips-dev/FolderView-Plus)](LICENSE.md)
[![Open Issues](https://img.shields.io/github/issues/alexphillips-dev/FolderView-Plus)](https://github.com/alexphillips-dev/FolderView-Plus/issues)
[![Last Commit](https://img.shields.io/github/last-commit/alexphillips-dev/FolderView-Plus/main)](https://github.com/alexphillips-dev/FolderView-Plus/commits/main)

FolderView Plus organizes Docker containers and VMs into folders directly inside Unraid, with a stronger settings UX, safer import/export flows, backup tooling, and quality-of-life improvements for daily use.

## Requirements

- Unraid `7.0.0` or newer

## Install

In Unraid, open `Plugins -> Install Plugin` and paste:

```text
https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg
```

CLI install:

```bash
plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg
```

## Update

- Preferred: `Plugins -> Check for Updates` in Unraid.
- Manual: run the same `plugin install` command again.

If GitHub cache delays an update banner, install once from a commit-pinned URL:

```text
https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/<commit>/folderview.plus.plg
```

Then return to normal `main` updates.

## Uninstall

```bash
plugin remove folderview.plus
```

## Key Features

- Folder views for Docker, VMs, and Dashboard
- Folder-level runtime actions (`Start`, `Stop`, `Pause`, `Resume`)
- Sort modes: `created`, `manual`, `alpha`
- Reliable manual reordering (up/down controls)
- Auto-assignment rules (regex + Docker labels)
- Rule testing and full simulator output
- Import preview with `Merge`, `Replace`, and `Skip existing`
- Pretty-printed exports with schema metadata
- Automatic pre-import backups + restore latest
- Scheduled backups via plugin cron runner
- Change history and one-click undo to latest transaction backup
- Diagnostics bundle and issue-report output
- Custom CSS/JS extension loading

## Quick Start

1. Open `Settings -> FolderView Plus`.
2. Create Docker and/or VM folders in their sections.
3. Choose your `Sort mode` (`Created`, `Manual`, or `Name`).
4. Use `Save` or `Save & Close`.
5. Go to Docker/VM tabs and confirm folder grouping.

## Settings Guide

Top controls in Customizations:

- `Search settings` filters visible settings content
- `Basic / Advanced` changes how many sections are shown
- `Wizard` reruns quick setup anytime
- Sticky action bar: `Save`, `Save & Close`, `Cancel`, `Reset section`

`Basic` mode focuses on day-to-day tasks:

- Docker folders and display/runtime controls
- VM folders and display/runtime controls
- Import/export/restore actions

`Advanced` mode additionally exposes:

- Auto-assignment rules
- Bulk assignment tools
- Runtime action planner
- Backup browser and schedules
- Folder templates
- Change history and undo
- Diagnostics and conflict inspector

## Auto-Assignment Rules

1. Switch to `Advanced` mode.
2. Open `Auto-assignment rules`.
3. Pick `Docker rules` or `VM rules`.
4. Select target folder, rule `Action` (`Include` or `Exclude`), and rule type.
5. Enter the needed match fields, then click `Add rule`.
6. Save changes.

Docker rule types:

- `Name regex`
- `Label equals`
- `Label contains`
- `Label starts with`
- `Image regex`
- `Compose project regex`

VM rule types:

- `Name regex`

Rule behavior:

- Rules run in priority order (top to bottom).
- First matching `Include` assigns the item.
- Any matching `Exclude` blocks assignment.
- Disabled rules are ignored.

Validation tools:

- `Test rule priority` for a single item
- `Simulate all items` for full assignment preview
- Rule search + bulk enable/disable/delete/export actions

## Import and Export

Export filenames:

- Docker full export: `FolderView Plus Export.json`
- VM full export: `FolderView Plus Export VM.json`
- Single-folder export: `<FolderName>.json`

Export format:

- Pretty-printed JSON (multi-line, readable)
- Metadata fields: `schemaVersion`, `pluginVersion`, `exportedAt`

Recommended import flow:

1. Export current config first.
2. Start import and review preview diff.
3. Pick mode: `Merge`, `Replace`, or `Skip existing`.
4. Apply import.
5. Use `Restore latest backup` if rollback is needed.

## Config and Customization Paths

- Plugin config root: `/boot/config/plugins/folderview.plus`
- Custom styles: `/boot/config/plugins/folderview.plus/styles`
- Custom scripts: `/boot/config/plugins/folderview.plus/scripts`

Custom file naming:

- CSS: `name.dashboard.css`, `name.docker.css`, `name.vm.css`
- JS: `name.dashboard.js`, `name.docker.js`, `name.vm.js`
- Multi-tab examples: `name.dashboard-docker.css`, `name.dashboard-docker-vm.js`

## Development

Source layout:

- Runtime files: `src/folderview.plus/`
- Plugin manifest: `folderview.plus.plg`
- Packaged releases: `archive/`

Package build script:

```bash
bash pkg_build.sh
```

## Support

- Issues: https://github.com/alexphillips-dev/FolderView-Plus/issues

## Credits

- [chodeus](https://github.com/chodeus/folder.view3) - FolderView Plus is built on the strong foundation established in folder.view3. Professional thanks for the original architecture, implementation groundwork, and iteration effort that made this project possible.

## License

See `LICENSE.md`.
