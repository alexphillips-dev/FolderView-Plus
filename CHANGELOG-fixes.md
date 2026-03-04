# FolderView Plus Changelog

## Version 2026.03.05.5

- Move VMs directly below Docker in settings for a cleaner reading order.
- Move Docker and VM auto-assignment rule editors into one dedicated bottom section.
- Preserve existing auto-assignment behavior while improving layout clarity.

## Version 2026.03.05.4

- Rework Docker/VM settings layout into clearer sections for actions, sorting, tables, and auto-assignment rules.
- Replace stretched full-width controls with grouped controls and responsive spacing for easier scanning.
- Improve auto-assignment UX with clearer helper text and cleaner editor/table alignment.

## Version 2026.03.05.3

- Align Name column entries with a centered fixed-width inner layout.
- Keep icon+text left-aligned within each row while preserving centered column positioning.

## Version 2026.03.05.2

- Always show up/down reorder controls in settings.
- Clicking reorder controls now auto-switches the list to manual mode before applying order changes.

## Version 2026.03.05.1

- Re-release of the 2026.03.04.10 fixes using a version string that avoids Unraid "older version" comparison edge cases.
- No functional changes from 2026.03.04.10.

## Version 2026.03.04.10

- Remove settings drag-and-drop reordering entirely.
- Replace with reliable button-based ordering (up/down) persisted via a dedicated server reorder endpoint.
- Improve order persistence reliability by writing folder order directly to plugin folder data.

## Version 2026.03.04.9

- Add guaranteed manual reorder controls (move up/down buttons) in settings for Docker/VM folder lists.
- Keep drag-and-drop reorder support, but no longer depend on drag events alone for manual ordering.

## Version 2026.03.04.8

- Fix manual folder reordering in plugin settings by switching to jQuery UI sortable with robust fallback.
- Improve reorder save error handling and visual drop placeholder feedback.

## Version 2026.03.04.7

- Fix folder rendering regression on Docker/VM/Dashboard pages caused by missing `utils` binding in runtime scripts.
- Add safe fallback loading for preferences requests so folder rendering continues if prefs endpoint is unavailable.

## Version 2026.03.04.6

- Add schema-aware import/export with metadata (`schemaVersion`, `pluginVersion`, `exportedAt`).
- Add import preview dialog with `Merge`, `Replace`, and `Skip existing` modes.
- Add automatic pre-import backup snapshots and one-click restore of latest backup.
- Add per-type sort preferences (`created`, `manual`, `alpha`) with manual drag ordering support.
- Add rule-based auto-assignment (`name regex` and Docker `label` rules).
- Add in-plugin update check endpoint and "Check for updates now" action.
- Add CI quality workflow with JavaScript/PHP syntax checks and utility tests.

## Version 2026.03.04.5

- Pretty-print exported JSON files for readable multi-line formatting.

## Version 2026.03.04.4

- Change default export filenames to use `FolderView Plus Export...` naming.

## Version 2026.03.04.3

- Remove all legacy compatibility paths and manifests.
- Enforce clean `folderview.plus` naming for plugin identity, paths, and labels.

## Version 2026.03.04.1

- Hard rename runtime and config paths to `folderview.plus`.

## Version 2026.03.03.1

- Fix Docker folder ordering by rebuilding placeholder order from folder definitions.
- Sync Docker order immediately after deleting one/all folders.

## Version 2026.02.26.5

- Improve release metadata handling for update detection.
