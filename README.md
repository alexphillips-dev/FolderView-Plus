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

Versioning format:

- Stable releases use `YYYY.MM.DD.UU` (for example `2026.03.06.26`)
- `UU` is a zero-padded update number to keep Unraid update ordering consistent
- Stable release date is always anchored to the current release day; only `UU` increments for multiple same-day releases
- Future-dated stable versions are blocked by release guard checks

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
- Import presets (built-in + custom) with per-type default preset selection persisted in plugin prefs
- Pretty-printed exports with schema metadata
- Automatic pre-import backups + restore latest
- Scheduled backups via plugin cron runner
- Snapshot compare for Docker/VM backups (`backup vs backup` or `backup vs current`) with optional preference diff
- Change history and one-click undo to latest transaction backup
- Global rollback checkpoints (Docker + VM folders and prefs)
- Diagnostics bundle and issue-report output
- Local icon management with built-in icon packs and direct upload support
- Custom CSS/JS extension loading
- Full mobile/touch support across Docker, VMs, Dashboard, and Settings (including Advanced section expand/collapse behavior)

## Browser Support

Supported major browsers (current versions):

- Google Chrome
- Microsoft Edge (Chromium)
- Mozilla Firefox
- Apple Safari (macOS + iOS)

Not supported:

- Internet Explorer 11
- Legacy Edge (EdgeHTML)
- Very old Safari/legacy mobile browsers that do not support modern JavaScript features used by the plugin

## Security Hardening

FolderView Plus includes compatibility-safe hardening updates:

- Request token rollout with compatibility mode (`compat`) to avoid breaking older cached clients during transition
- Guarded POST backup download path (`download_post`) with temporary legacy GET fallback during migration
- Response hardening headers on plugin JSON/file responses (`X-Content-Type-Options: nosniff`)
- Safer UI rendering for dynamic folder/action text to reduce injection/XSS risk
- Security regression tests to help prevent these protections from regressing in future updates

## Quick Start

1. Open `Settings -> FolderView Plus`.
2. Create Docker and/or VM folders in their sections.
3. Choose your `Sort mode` (`Created`, `Manual`, or `Name`).
4. Use `Save` or `Save & Close`.
5. Go to Docker/VM tabs and confirm folder grouping.

## Settings Guide

Top controls in Customizations:

- `Search settings` filters visible settings content
- `Search all advanced` optionally broadens search beyond current advanced tab
- `Basic / Advanced` changes how many sections are shown
- `Wizard` reruns quick setup anytime
- `Create rollback checkpoint` snapshots Docker/VM folders and prefs
- `Rollback to previous snapshot` restores previous global checkpoint in one click
- Sticky action bar: `Save`, `Save & Close`, `Cancel`, `Reset section`

`Basic` mode focuses on day-to-day tasks:

- Docker folders and display/runtime controls
- VM folders and display/runtime controls
- Import/export/restore actions

`Advanced` mode additionally exposes:

- Tabbed advanced workspaces (`Automation`, `Recovery`, `Operations`, `Diagnostics`)
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

## Mobile Support

FolderView Plus is fully supported on mobile and touch devices.

Included behavior:

- Touch-friendly folder interactions on Docker and VM tabs
- Responsive layouts for Docker, VM, Dashboard, and settings workflows
- Advanced settings section expand/collapse support on mobile
- Mobile-safe icon picker interactions in folder editor flows

Regression safeguards:

- Dedicated mobile tests:
  - `tests/mobile-touch-support.test.mjs`
  - `tests/mobile-regression-guard.test.mjs`
- CI step: `Run mobile guard tests`
- Release guard checks that mobile settings JS/CSS files are present in package output and match source

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
3. Pick a preset (or save your own), then confirm mode: `Merge`, `Replace`, or `Skip existing`.
4. Apply import.
5. Use `Restore latest backup` if rollback is needed.

Import preset behavior:

- Built-ins: merge safely, replace fully, add new only, dry-run merge
- Save custom presets from current mode + dry-run selection
- Set a per-type default preset (Docker and VM tracked independently)
- Presets are stored in plugin prefs, so they survive browser switches and reinstall/restore workflows

Backup compare behavior:

- Compare any backup against another backup, or against current live folders
- Optional `Include preference changes` toggle to diff sort/pin/runtime/health/schedule/import-preset prefs
- Paginated compare tables for large libraries

## Config and Customization Paths

- Plugin config root: `/boot/config/plugins/folderview.plus`
- Custom styles: `/boot/config/plugins/folderview.plus/styles`
- Custom scripts: `/boot/config/plugins/folderview.plus/scripts`
- Third-party icon packs: `/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons`
- Uploaded custom icons: `/usr/local/emhttp/plugins/folderview.plus/images/custom`

Custom file naming:

- CSS: `name.dashboard.css`, `name.docker.css`, `name.vm.css`
- JS: `name.dashboard.js`, `name.docker.js`, `name.vm.js`
- Multi-tab examples: `name.dashboard-docker.css`, `name.dashboard-docker-vm.js`

## Integrated Icon Packs

FolderView Plus includes built-in support for local icon pack browsing so you can manage icons directly from the folder editor UI without manual URL hunting.

Included pack sources:

- https://github.com/sameerasw/folder-icons
- https://github.com/hernandito/unRAID-Docker-Folder-Animated-Icons---Alternate-Colors

How this helps:

- Organized local icon sets for faster folder icon assignment
- Easier long-term icon management inside your own plugin install
- Consistent icon workflow across Docker and VM folders

## Development

Source layout:

- Runtime files: `src/folderview.plus/`
- Plugin manifest: `folderview.plus.plg`
- Packaged releases: `archive/`

Package build script:

```bash
bash pkg_build.sh
```

Release preparation (auto version bump/build, md5, CHANGES entry, release guard, install smoke, tests):

```bash
bash scripts/release_prepare.sh
```

Run only mobile guard tests locally:

```bash
node --test tests/mobile-touch-support.test.mjs tests/mobile-regression-guard.test.mjs
```

Enable local push blocking when release checks fail:

```bash
bash scripts/install_git_hooks.sh
```

## Support

- Issues: https://github.com/alexphillips-dev/FolderView-Plus/issues

## Credits

- [chodeus](https://github.com/chodeus/folder.view3) - FolderView Plus is built on the strong foundation established in folder.view3. Professional thanks for the original architecture, implementation groundwork, and iteration effort that made this project possible.
- [sameerasw](https://github.com/sameerasw/folder-icons) and [hernandito](https://github.com/hernandito/unRAID-Docker-Folder-Animated-Icons---Alternate-Colors) - Thank you for creating and sharing high-quality icon collections that improve local icon management and the overall FolderView Plus user experience.

## License

See `LICENSE.md`.
