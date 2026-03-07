# FolderView Plus

[![Unraid 7.0.0+](https://img.shields.io/badge/Unraid-7.0.0%2B-F15A2C?logo=unraid&logoColor=white)](https://unraid.net/)
[![License: MIT](https://img.shields.io/github/license/alexphillips-dev/FolderView-Plus)](LICENSE.md)
[![Open Issues](https://img.shields.io/github/issues/alexphillips-dev/FolderView-Plus)](https://github.com/alexphillips-dev/FolderView-Plus/issues)
[![Last Commit](https://img.shields.io/github/last-commit/alexphillips-dev/FolderView-Plus/main)](https://github.com/alexphillips-dev/FolderView-Plus/commits/main)

FolderView Plus adds folder-based organization for Docker and VMs in Unraid, with safer import/backup workflows and a faster settings experience.

## Requirements

- Unraid `7.0.0+`

## Install

Unraid UI (`Plugins -> Install Plugin`) or CLI:

```bash
plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg
```

## Update

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

```bash
plugin remove folderview.plus
```

## What You Get

- Folder views for Docker, VMs, and Dashboard
- Manual folder ordering (up/down), plus created and A-Z sort modes
- Auto-assignment rules:
  - Docker: name regex, label/image/compose matching
  - VM: name regex
- Rule tester + simulator + conflict inspector
- Safer import flow with preview and mode selection (`Merge`, `Replace`, `Skip existing`)
- Pretty-printed schema exports with metadata
- Automatic pre-import backups and one-click restore
- Scheduled backups, snapshot compare, change history, and undo
- Folder templates and bulk assignment tools
- Built-in/third-party/custom icon workflows
- Mobile/touch support across tabs and settings

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

Rule order is priority-based (top to bottom). Exclude rules block assignment.

## Import, Export, Backups

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

## Browser Support

Supported current major browsers:

- Chrome
- Edge (Chromium)
- Firefox
- Safari (macOS + iOS)

Not supported:

- Internet Explorer 11
- Legacy Edge (EdgeHTML)

## Security Notes

- Request-token and guarded endpoint protections are included
- Safer dynamic text rendering for XSS resistance
- Security and regression tests are part of CI

## Paths

- Config root: `/boot/config/plugins/folderview.plus`
- Custom CSS: `/boot/config/plugins/folderview.plus/styles`
- Custom JS: `/boot/config/plugins/folderview.plus/scripts`
- Third-party icons: `/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons`
- User-uploaded icons: `/usr/local/emhttp/plugins/folderview.plus/images/custom`

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

- Issues: https://github.com/alexphillips-dev/FolderView-Plus/issues

## Credits

- [chodeus](https://github.com/chodeus/folder.view3) - FolderView Plus is built on the foundation of folder.view3. Thank you for the original architecture and groundwork.
- [sameerasw](https://github.com/sameerasw/folder-icons) and [hernandito](https://github.com/hernandito/unRAID-Docker-Folder-Animated-Icons---Alternate-Colors) - Thank you for the icon packs and ongoing community value.

## License

See `LICENSE.md`.
