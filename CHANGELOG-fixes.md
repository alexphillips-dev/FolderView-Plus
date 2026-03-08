# FolderView Plus Changelog

## Version 2026.03.08.16

- Convert Setup Assistant to a centered compact modal instead of oversized full-window inset layout.
- Replace uncapped wizard min-font tokens with clamped size tokens to prevent giant text when theme root font is large.
- Force quick-preset card text wrapping and neutral button text transform/letter spacing so labels remain readable.
- Add mobile-specific resets for centered dialog positioning at the existing mobile breakpoint.
- Extend UI smoke tests for compact centered dialog sizing and clamped wizard font token behavior.

## Version 2026.03.08.15

- Remove redundant `Wizard path` line from Setup Assistant Welcome card (step flow already exists in sidebar).
- Compact Setup Assistant sidebar/menu footprint with tighter spacing and a narrower sidebar width.
- Add UI smoke-test assertions for compact wizard sidebar sizing.

## Version 2026.03.08.13

- Enforce hard minimum text size tokens for Setup Assistant (wizard) so menu/body text stays readable across theme/root font overrides.
- Apply the wizard min-font tokens across step navigation, profile/import/rules/behavior cards, review notes, and progress text.
- Add smoke-test coverage to guard wizard minimum font token wiring and prevent regression.

## Version 2026.03.08.12

- Improve Setup Assistant with in-wizard quick start bundles (Balanced, Minimal, Power, Media Stack).
- Add clickable wizard sidebar step navigation and a one-click Review jump action.
- Add Copy Summary action in wizard review to export the full plan snapshot to clipboard.
- Add setup keyboard shortcuts: Alt+Left/Right for step movement, Ctrl+Enter to apply from review, Ctrl+Shift+C to copy summary.
- Add UI regression checks for new wizard controls and styles.

## Version 2026.03.06.8

- Add full rules simulator for Docker/VM to preview assignment outcomes across all items.
- Upgrade import preview with row-level diffs (action, id, name, changed fields).
- Add cron-backed scheduled backup runner so schedules execute on time without opening the UI.
- Add performance-focused lazy preview controls (enable + threshold) and runtime handling for large folders.
- Add bulk rule actions (enable/disable/delete/export) and bulk template actions (delete/export).
- Add searchable filters for folder lists, rules, backups, and templates.
- Add diagnostics issue-report copy action and include compact recent timeline in diagnostics data.
- Expand CI test coverage with additional utility tests plus UI binding smoke tests.

## Version 2026.03.06.7

- Add folder templates support (save/apply/delete) with server endpoint and settings UI.
- Add conflict inspector report for Docker/VM assignment overlap and exclude-rule blocking visibility.
- Add support bundle export flow with Full/Sanitized mode selection.
- Add runtime live auto-refresh support (enable/disable + interval) for Docker/VM/Dashboard.
- Add runtime performance mode behavior that disables heavy preview features at render time.
- Improve rule engine consistency so matching exclude rules always block final assignment.

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
