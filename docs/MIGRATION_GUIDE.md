# Migration Guide

FolderView Plus keeps compatibility paths for `folder.view`, `folder.view2`, and `folder.view3`, but migration should still begin with an export and a review. Do not remove the previous plugin or its data until the FolderView Plus layout has been verified.

## What is supported

FolderView Plus supports:

- Legacy full and single-folder exports from FolderView2 and FolderView3.
- Older type-wrapped export shapes recognized by the import parser.
- Legacy Docker assignment labels: `folder.view`, `folder.view2`, `folder.view3`, and `folderview.plus`.
- Existing folder-level legacy regex values at runtime, during import/export, and in backups.
- Legacy custom CSS and JavaScript override directories.

Compatibility does not mean every older visual customization will match the current UI without review. Stable selectors and the deprecation policy are documented in [Support Policy](SUPPORT_POLICY.md).

## Before migrating

1. Export the Docker and VM folder configuration from the existing installation.
2. Copy the export files off the Unraid flash device.
3. Back up the previous plugin configuration directory.
4. Record any custom CSS, JavaScript, icons, labels, regex rules, and unusual nested layouts.
5. Install FolderView Plus.
6. Keep the old data until the migration and runtime pages have been verified.

If FolderView Plus starts with empty or missing current configuration, its compatibility layer can discover eligible FolderView2 or FolderView3 data and migrate folder maps and default preferences. Use the explicit import flow when you want a visible preview and control over each operation.

## Setup Assistant migration route

The Setup Assistant can include Docker and VM imports in a guided plan. Import is optional for a fresh setup. A migration route only requires an enabled import when the selected route is specifically intended to migrate existing data.

For each import:

1. Select the matching Docker or VM export.
2. Wait for schema and compatibility validation.
3. Enable that import for the setup plan.
4. Review the detected folders, rules, and settings.
5. Continue to Review and apply only when the plan is correct.

Docker exports cannot be applied to VMs, and VM exports cannot be applied to Docker.

## Import behavior

The standalone import dialog uses three plain-language modes:

### Merge safely

Adds missing folders and updates matching folders. It does not delete a destination folder merely because that folder is absent from the export. This is the recommended choice for most migrations.

### Add new only

Creates folders that do not exist and leaves existing destination folders unchanged. Use this when the current configuration must remain authoritative.

### Replace exactly

Makes the destination match the export. Existing destination folders absent from the selected export can be deleted. Use this only when the export is intended to be the complete source of truth.

Changing the mode recalculates the preview. The optional changed-folder table identifies creates, updates, deletes, and affected fields. `Preview only` performs the calculation without saving. A live import creates an automatic backup before committing the selected operations.

## Folder identity and hierarchy

Current exports contain schema and folder identity metadata. Legacy exports may rely more heavily on names and hierarchy paths.

- Existing folders are matched conservatively.
- Nested folders are ordered with parents before descendants.
- Legacy nested IDs can be remapped by a matching parent/name path.
- Ambiguous path collisions are reported as conflicts instead of being guessed.
- Sparse or unresolved icon paths fall back safely rather than invalidating an otherwise usable import.

Resolve duplicate names at the same parent level before migration when possible. After import, inspect parent relationships and member assignments before running bulk actions.

## Legacy regex and Advanced Auto-Rules

Existing folder-level regex values remain supported, but Advanced Auto-Rules are the current automation model.

- Empty legacy regex controls are hidden for new folders.
- A folder with a legacy regex shows a compatibility summary and current match/conflict counts.
- `Convert to Auto-Rule` creates an Include / Name regex rule at the end of the global rule list.
- Existing higher-priority Advanced rules keep their precedence.
- Conversion creates a backup and updates rule preferences plus the folder record as one guarded workflow.
- An invalid legacy pattern is not converted automatically; repair it first.

Convert one rule, test its matches, and verify the target folder before converting a large set. Imported legacy regex continues to run until explicitly converted.

## Custom overrides

Legacy override roots remain readable:

- `/boot/config/plugins/folder.view/styles`
- `/boot/config/plugins/folder.view2/styles`
- `/boot/config/plugins/folder.view3/styles`
- `/boot/config/plugins/folder.view/scripts`
- `/boot/config/plugins/folder.view2/scripts`
- `/boot/config/plugins/folder.view3/scripts`

Move maintained overrides into:

- `/boot/config/plugins/folderview.plus/styles`
- `/boot/config/plugins/folderview.plus/scripts`

Keep the existing `*.docker.*`, `*.vm.*`, or `*.dashboard.*` suffix conventions. Disable an override by appending `.disabled`. Test without overrides first if the current interface clips, displays stale controls, or fails to initialize.

## Icons

An imported folder can retain a valid custom or built-in icon reference. Unavailable or unreasonable icon data falls back safely. The large built-in third-party library is supplied by the separate verified icon asset pack; it is not embedded into every configuration export.

Copy user-uploaded icon data or restore the complete FolderView Plus configuration directory when moving between USB devices. See [Installation and Upgrades](INSTALLATION_AND_UPGRADES.md#versioned-icon-asset-pack) for asset-pack recovery.

## Verification checklist

After migration, verify:

- Docker folder count, hierarchy, names, icons, order, and pinned state.
- VM folder count, hierarchy, names, icons, and order.
- Direct members and collapsed-preview visibility.
- Dashboard Docker and VM folder rendering.
- Advanced Auto-Rules and remaining legacy regex matches.
- Custom folder actions and their selected members.
- Docker start-order plan.
- Privacy masks and performance profile.
- Backups, scheduled backup settings, and Diagnostics health.

Start and stop one test container and one test VM when available. Confirm the folder preview and native expanded row reconcile without a page refresh.

## Rollback

If the migration is wrong:

1. Stop applying new changes.
2. Open `Advanced -> Recovery`.
3. Compare the pre-import safety snapshot with the current state.
4. Use Undo or restore the selected non-empty snapshot.
5. If plugin-local recovery is unavailable, import the external export using the appropriate behavior mode.
6. Export a sanitized support bundle before further repair if the failure is not understood.

Do not manually merge JSON fragments from different revisions. FolderView Plus maintains metadata revisions and recovery copies around durable writes; using the supported workflows preserves those relationships.
