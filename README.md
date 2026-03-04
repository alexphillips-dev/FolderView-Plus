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
- Rule-based auto-assignment using name regex (Docker + VMs) and Docker label rules
- Sort modes per type: `created`, `manual`, `alpha`
- Better release/version metadata handling for more consistent update detection in Unraid
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
- Docker label support for automatic folder assignment
- Rule-based auto-assignment using name regex and Docker labels
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

See the developer extension guide in `dev/README.md`.

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

- Built on top of an upstream open-source foundation, with continued improvements focused on reliability, UX, and maintainability.

## License

See `LICENSE.md`.
