# FolderView Plus User Guide

This guide covers the normal FolderView Plus workflow after installation. Start with a small manual layout, verify it on the runtime pages, and add automation only after the layout behaves the way you expect.

## Settings modes

Open `Settings -> FolderView Plus`.

- **Basic** contains everyday folder creation, ordering, membership, visibility, and display controls.
- **Advanced** contains Automation, Rules, Recovery, Operations, Start Order, Appearance, and Diagnostics.
- **Setup Assistant** provides a guided first-run or migration flow. It previews the planned changes and does not require an import file for a fresh setup.

Settings search matches labels and common aliases. Change its scope when you want to search only the current mode or include all Advanced workspaces.

## Create a folder

1. Open the Docker or VM table in Basic settings.
2. Select `Add folder`.
3. Give the folder a unique name within its selected parent.
4. Choose an icon or keep the default.
5. Select the members that belong in the folder.
6. Review the live preview and save.

The modern folder editor separates controls into General, Members, Preview, Chevron, Status, Rules, Actions, and Advanced tabs. The preview is a design preview; the Docker, VM, and Dashboard pages remain the final runtime check.

## Build a hierarchy

A folder can be placed under another folder. The parent picker controls the hierarchy, while the Members tab controls containers or VMs assigned directly to the folder.

- A member should normally belong to only one effective folder.
- Moving a parent keeps its branch together.
- Pinned nested folders promote their root branch when the visible ordering is calculated.
- Use the folder action sheet for branch-level move, pin, export, integrity, and delete operations.

Use shallow hierarchies first. Deep trees are supported, but a small number of meaningful levels is easier to scan and maintain.

## Order folders and members

The six-dot handles in Basic settings reorder folders when manual ordering is active. The same handle is available for members in the modern folder editor. Arrow controls remain available where a precise one-step move is useful.

Automatic sort modes can order by name or timestamp. Pinned folders are resolved before the selected sort mode. Switch back to manual ordering before expecting a drag operation to define the complete order.

## Configure collapsed previews

The Preview tab controls what is shown while a runtime folder is collapsed.

- Include or exclude individual members from the collapsed preview without changing membership.
- Choose whether child folders appear in a parent's preview.
- Configure preview depth, icon, label, status, and action visibility.
- If every included member is hidden from preview, the editor displays an explanatory empty state instead of pretending the folder has no members.

Expanding a folder shows its native Unraid rows. Collapsing it returns to the configured preview.

## Runtime page views

The Docker page View menu provides three supported modes:

- **FolderView** groups native rows into the saved folder hierarchy.
- **Host list** restores Unraid's normal Docker table without FolderView grouping.
- **Command** presents a folder-oriented command surface while retaining access to native container actions.

Changing views does not delete folder configuration. Use `Reset view` to clear temporary toolbar filters and return to the normal unfiltered state.

Each Docker folder menu includes four quick actions: focus, pin, lock, and hide. Hiding a parent hides its complete nested branch and member rows from FolderView without deleting configuration or changing assignments. Use the temporary `Undo` notice immediately after hiding, or open `View -> Hidden folders` to reveal hidden rows. Revealed rows are dimmed and labeled `Hidden`; restore one from its folder menu or choose `Restore all hidden folders`. Hidden folders remain visible in Host list mode because that mode intentionally restores Unraid's native table.

VM and Dashboard surfaces use the same saved Docker or VM folder configuration where applicable. Runtime state is reconciled incrementally so start, stop, pause, resume, and update results can update without rebuilding the entire page.

## Folder actions

### Custom WebUI profiles for Docker folders

Use a custom WebUI profile when you regularly open only part of a Docker folder. Profiles do not store URLs. They store selected direct-member names and resolve each container's current safe WebUI address and running state at launch time.

To create a profile:

1. Edit a Docker folder and open **WebUI Profiles**.
2. Select **Add profile** and enter a unique name.
3. Select one or more direct folder members. Search, **Select all with WebUI**, and **Clear selection** are available for larger folders.
4. Save the folder. Empty profiles and duplicate names are rejected.
5. Open the folder menu on the Docker page, choose **Open WebUI profile**, and select the profile. Its ready count shows how many selected WebUIs can open now.

Only selected containers that are running, not paused, and expose a safe WebUI are opened. Stopped, paused, removed, or currently unavailable members remain selected for later but are skipped. If a browser blocks one or more tabs, allow popups for the Unraid host and retry the same profile. The original **Open all WebUIs** action still opens every ready WebUI in that folder.

Use **Manage WebUI profiles** in the folder menu to return directly to the editor section. Profiles can be duplicated, reordered, or deleted. Each folder supports up to 100 profiles with up to 250 selected members per profile. Container renames are reconciled automatically when FolderView Plus can uniquely identify the renamed container; unresolved members are labeled unavailable so the selection can be corrected manually.

Profiles follow a full folder clone and are preserved by folder export/import and backup/restore. Generic **Copy Folder Settings**, reusable templates, smart defaults, and saved folder defaults omit them so container-specific selections are not applied to unrelated folders.

> Screenshot placeholder: WebUI Profiles editor showing named profiles and selected members.

> Screenshot placeholder: Docker folder menu showing Open all WebUIs, Open WebUI profile, ready counts, and Manage WebUI profiles.

The folder action sheet groups actions by purpose rather than placing every operation in one flat menu. Available actions depend on folder type, hierarchy position, lock state, and current member state.

Common actions include:

- Edit, pin, focus, lock, hide, expand, or collapse a folder or branch.
- Start, stop, pause, resume, restart, or update eligible members.
- Move a folder within its current level, under another folder, or back to the root.
- Clone, export, import into, scan, repair, or delete a folder branch.
- Copy the folder ID for diagnostics or advanced integrations.

Folder locks and eligibility checks prevent unsupported runtime operations. Review destructive confirmations carefully because branch deletion can affect nested folders.

## Rules and automatic assignment

Advanced Auto-Rules are the primary automation system. Rules are evaluated in their saved priority order; the first enabled matching include or exclude decision wins.

1. Open `Advanced -> Rules`.
2. Create a rule for a supported name, label, Compose, or metadata match.
3. Select Include or Exclude and the target folder.
4. Test the rule against current inventory.
5. Review conflicts and the assignment preview.
6. Apply the plan only after the preview is correct.

Legacy folder regex remains compatible for imports and existing installations, but new automation should use Advanced Auto-Rules. See [Migration Guide](MIGRATION_GUIDE.md) before converting legacy regex rules.

## Bulk assignment and templates

Use `Advanced -> Automation` when many members need to move at once. Bulk plans are validated as one operation and committed atomically, so an invalid target blocks the complete batch instead of leaving a partial move.

Templates save reusable folder settings. Review member-bound custom actions when copying or applying a template because actions that depend on unavailable members are disabled for safety.

## Import and export

The import dialog begins with one behavior decision:

- **Merge safely** adds missing folders and updates matches without deleting folders absent from the export.
- **Add new only** creates missing folders and leaves existing folders unchanged.
- **Replace exactly** makes the destination match the export and can delete folders that are absent from it.

The dialog then shows change totals and optional detailed review. A live import creates an automatic safety backup. `Preview only` calculates the result without saving. See [Migration Guide](MIGRATION_GUIDE.md) for legacy exports and [Installation and Upgrades](INSTALLATION_AND_UPGRADES.md) for backup planning.

## Backups and recovery

Open `Advanced -> Recovery` to:

- Create a manual snapshot.
- Enable and configure scheduled backups.
- Compare snapshots.
- Restore the latest non-empty snapshot or a selected snapshot.
- Delete old snapshots.
- Undo a recent destructive operation when an undo-capable safety snapshot exists.

Safety backups are created before supported imports, restores, bulk changes, and other destructive workflows. Keep an external export before uninstalling or replacing the USB configuration because plugin-local backups live under the plugin configuration directory.

## Docker start order

`Advanced -> Start Order` can follow the Docker page folder order or define custom startup batches. Custom plans can specify groups, members, and delays. Always preview and validate a changed plan before syncing it to the host.

## Performance profiles

Docker and VM runtime settings provide three profiles:

- **Standard** keeps normal motion and refresh behavior and does not impose a profile-specific expansion cap.
- **Adaptive** is recommended for most servers. It increases safeguards when library size or measured render cost indicates a larger workload.
- **Maximum** uses reduced motion, deferred preview work, the smallest expansion restore limit, and the longest minimum refresh interval.

These profiles change presentation and refresh work; they do not remove configured members or disable collapsed previews. See [Runtime Performance Budgets](runtime-performance-budgets.md) for the enforced benchmark model.

## Privacy mode

The Docker-page Privacy toggle hides selected values without changing the stored Docker configuration. Its adjacent options menu controls individual masks. Settings provides the same saved choices. See [Privacy Guide](PRIVACY.md) for the exact fields and the difference between runtime masking and support-bundle sanitization.

## Diagnostics and support

Open `Advanced -> Diagnostics` to run health checks, inspect core and advisory results, copy an issue report, and preview or export a support bundle. Use a sanitized bundle for public reports unless raw values are explicitly required.

When a runtime page shows an error banner, copy its diagnostics before refreshing. See [Troubleshooting](TROUBLESHOOTING.md) for targeted checks and [Compatibility](COMPATIBILITY.md) for supported environments.
