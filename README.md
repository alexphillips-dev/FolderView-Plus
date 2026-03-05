# FolderView Plus

[![Unraid 7.0.0+](https://img.shields.io/badge/Unraid-7.0.0%2B-F15A2C?logo=unraid&logoColor=white)](https://unraid.net/)
[![License: MIT](https://img.shields.io/github/license/alexphillips-dev/FolderView-Plus)](LICENSE.md)
[![Open Issues](https://img.shields.io/github/issues/alexphillips-dev/FolderView-Plus)](https://github.com/alexphillips-dev/FolderView-Plus/issues)
[![Last Commit](https://img.shields.io/github/last-commit/alexphillips-dev/FolderView-Plus/main)](https://github.com/alexphillips-dev/FolderView-Plus/commits/main)

FolderView Plus is built on the credited upstream project and extends it with
major quality-of-life, reliability, and UX improvements for Unraid users:

- Cleaner plugin settings layout with grouped controls and improved bottom-section readability
- Reliable manual folder ordering using dedicated up/down controls (drag ordering removed)
- Better Name column alignment for consistent icon/text presentation
- Improved export UX with branded filenames (`FolderView Plus Export...`)
- Pretty-printed, human-readable JSON exports (multi-line/indented)
- Safer import flow with preview dialog and merge modes (`Merge`, `Replace`, `Skip existing`)
- Schema-aware import/export metadata: `schemaVersion`, `pluginVersion`, `exportedAt`
- Automatic backup creation before import with one-click restore support
- Cron-backed scheduled backups that run on time without opening plugin settings
- Rule-based auto-assignment using name regex (Docker + VMs) and Docker label rules
- Rule simulator for full-item assignment preview (assigned/blocked/unassigned)
- Folder templates (save/apply/delete) for reusable folder configurations
- Bulk actions for rules/templates (enable/disable/delete/export where applicable)
- Folder pinning and optional hide-empty folder view in settings
- Runtime action planner with preview + apply (`Start`, `Stop`, `Pause`, `Resume`) per folder
- Change history panel with one-click undo to latest transaction backup
- Sort modes per type: `created`, `manual`, `alpha`
- Search filters in settings for folders, rules, backups, and templates
- Diagnostics support bundle and copyable issue report text for faster issue filing
- Runtime lazy preview controls for large libraries (`lazy preview` + threshold)
- Better release/version metadata handling for more consistent update detection in Unraid
- Release guardrails in CI/workflows for `.plg` validity, archive/version/md5 consistency
- Continued folder-based views across Docker, VMs, and Dashboard pages

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

If GitHub cache delays the update banner, install from a commit-specific `.plg` URL once, then return to normal updates.

## Uninstall

```bash
plugin remove folderview.plus
```

## What It Adds

- Folder organization for Docker and VM tabs
- Folder grouping on Dashboard widgets
- Folder-level start and stop actions
- Import/export of folder definitions with schema metadata validation
- Import preview with `Merge`, `Replace`, and `Skip existing` modes before applying changes
- Automatic pre-import backups with one-click latest-backup restore
- Scheduled backups via cron runner (`/usr/local/emhttp/plugins/folderview.plus/scripts/scheduled_backup.php`)
- Docker label support for automatic folder assignment
- Rule-based auto-assignment using name regex and Docker labels
- Rule simulator to preview final assignment outcomes across all Docker/VM items
- Bulk rule and template operations in settings
- Folder pin/unpin controls and hide-empty toggle
- Runtime bulk folder action preview/apply workflow for Docker and VMs
- Change history viewer and latest-change undo action
- Search and filtering for settings tables (folders/rules/backups/templates)
- Folder templates to copy folder settings/actions/regex between folders
- Folder sort modes: `created`, `manual`, `alpha`
- Reliable manual reorder controls (up/down) in settings
- Cleaner settings layout for actions, sorting, tables, and rule editing
- Custom CSS and JS extension loading

## Usage

After install, use the folder controls on Docker and VM pages to create and manage folders.

Docker label example:

```yaml
services:
  my-app:
    labels:
      folderview.plus: "Media"
```

## Import and Export

- Full Docker export filename: `FolderView Plus Export.json`
- Full VM export filename: `FolderView Plus Export VM.json`
- Single-folder export filename: `<FolderName>.json`

Exports are pretty-printed JSON (multi-line, indented) for easier review and editing.
Exports include schema metadata (`schemaVersion`, `pluginVersion`, `exportedAt`) for safer import validation.

## Config and Customization Paths

- Plugin config root: `/boot/config/plugins/folderview.plus`
- Custom styles: `/boot/config/plugins/folderview.plus/styles`
- Custom scripts: `/boot/config/plugins/folderview.plus/scripts`

Custom file naming:

- CSS: `name.dashboard.css`, `name.docker.css`, `name.vm.css`
- JS: `name.dashboard.js`, `name.docker.js`, `name.vm.js`
- Multi-tab examples: `name.dashboard-docker.css`, `name.dashboard-docker-vm.js`

## Development

Source tree:

- Runtime files: `src/folderview.plus/`
- Plugin manifest: `folderview.plus.plg`
- Packaged releases: `archive/`

Build package:

```bash
bash pkg_build.sh
```

## Support

- Issues: https://github.com/alexphillips-dev/FolderView-Plus/issues

## Credits

- [chodeus](https://github.com/chodeus/folder.view3) - FolderView Plus is built on the strong foundation established in folder.view3. Sincere professional thanks for the original architecture, implementation groundwork, and prior iteration effort that made it possible to move quickly, focus on reliability, and deliver meaningful quality-of-life improvements.

## License

See `LICENSE.md`.
