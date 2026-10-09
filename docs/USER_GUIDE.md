# FolderView Plus User Guide

This guide covers the normal FolderView Plus workflow after installation. Start with a small manual layout, verify it on the runtime pages, and add automation only after the layout behaves the way you expect.

## Settings modes

Open `Settings -> FolderView Plus`.

- **Basic** contains everyday folder creation, ordering, membership, visibility, and display controls.
- **Advanced** groups Operations, Bulk assignment, Rules, and Docker start order under Workflows; Appearance in its own group; and Recovery, Diagnostics, and Logs under Support. On desktop, choose a section from the left rail. On a phone, use the section picker above the content.
- **Setup Assistant** provides a guided first-run or migration flow. It previews the planned changes and does not require an import file for a fresh setup.

Settings search matches labels and common aliases. Change its scope when you want to search only the current mode or include all Advanced workspaces.

## Create a folder

1. Open the Docker or VM table in Basic settings.
2. Select `Add folder/group`, then choose **Single folder**.
3. Enter the folder name, choose an icon or keep the default, and select **Create folder**.
4. Open the new folder's editor to choose its parent, assign members, review the preview, and save its settings.

To create several folders together, choose **Preconfigured groups** in the same popup. The categories and Smart suggestions use the setup wizard's folder templates. Select the folders you want, then choose **Create folders**. Existing matching folder names are skipped.

Choose **My groups** to build your own reusable group. Enter a group name, add folder names and icons, and select **Save group**. You can reopen the popup and choose it from **Saved groups**, edit and save it, or select **Create folders** to deploy it. Saving a group does not create folders. Deleting a saved group leaves existing folders intact. Docker and VM groups are stored separately on the server, with up to 30 saved groups per type and 50 folders per group.

Groups create root-level folders using the existing folder creation defaults. They store folder names and icons, without member assignments; use the folder editor for nesting, members, and other settings. The Basic toolbar's **Ctrl+K** shortcut (or **Cmd+K** on macOS) focuses the folder search in the current table, or the first visible table when focus is elsewhere.

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

For tree moves, drop a folder on **Before**, **Inside**, or **After**, or use **Move folder** with the keyboard. The row moves immediately while saving; a failed save restores its previous position. Before/After moves select Manual sorting, while Inside/root moves keep the current sort mode. Move and reorder Undo/Redo belongs to the current browser session and does not create a backup for every adjustment.

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

## Quick finder on Docker and VMs

Click the borderless magnifying glass immediately to the left of the native Basic/Advanced view controls. Quick finder mounts during toolbar startup, alongside Docker Privacy controls, without waiting for folder data to finish loading. It expands into a search field; the dropdown appears only after you type. Clearing the query hides the dropdown, and closing search clears the query. If the host page does not provide view controls, Quick finder appears above the table. `Ctrl+K` (`Command+K` on macOS) opens it; Escape or clicking outside closes it. The animation respects reduced-motion preferences.

Docker searches Docker folders and containers; VMs searches VM folders and virtual machines. Search matches names and containing folder paths, including collapsed nested folders. Result cards display configured folder and member icons, with a generic fallback if an icon is missing or cannot load. Use **All**, **Folders**, or the member-type filter to narrow results. Up to 40 matches are rendered at once; refine the query when the total exceeds that limit. The query is temporary and is not saved or added to diagnostics.

- Click a result's name or select it with the arrow keys and press **Enter** to reveal it. This clears temporary folder focus and Docker toolbar filters, expands the containing folder path, and highlights the native row. Docker returns to FolderView when necessary. Revealing a hidden Docker branch uses the existing temporary hidden-folder visibility control without restoring its saved hidden state.
- Folder results offer **Focus folder** and **Edit folder**. A folder without a rendered row, such as an empty folder suppressed by visibility settings, offers editing rather than an unavailable reveal action.
- Results appear in icon cards under counted **Folders** and **Containers** (or **Virtual machines**) sections. Click a section heading to collapse or expand it. The **All**, **Folders**, and member tabs filter the results; an empty search shows no results.
- Folder cards place **Focus folder** and **Edit folder** beside the name and folder path. Three-dot **Actions** controls open the existing folder or member menu when Unraid provides one.
- Container cards retain the Docker preview structure and show their configured icon, name, colored running/stopped/paused status, and containing folder path. The globe, terminal, and list icons provide **Open WebUI**, **Open console**, and **View logs** shortcuts; their tooltips and accessible labels identify each action. WebUI requires a running container with an available safe WebUI; console requires a running container and the host terminal handler. Unavailable shortcuts stay visible but disabled. Logs remain available for stopped containers when the host terminal handler is present.
- VM results offer **View logs** when the host supplies a log location and **Actions** to open the existing native VM menu. Available console and power controls remain governed by Unraid.

Arrow keys select results and Enter reveals the selected item. Privacy name masking masks result names, icons, and folder paths; the search field and the query you type stay readable. Searching does not change folder assignments or start, stop, or update members.

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

1. Open `Advanced -> Rules` and choose **Docker** or **VMs**. Summary cards show the total, active and exclude rules, and targeted folders.
2. In **Create rule**, select the target folder, Include or Exclude, the match field, and Contains, Starts with, Ends with, or Exact. Enter the match value and check the live match count before saving.
3. Open **Advanced options** for raw regular expressions or Docker label keys. Label rules support Contains, Starts with, and Exact; an empty Exact value matches any value for that key.
4. Use **Scan suggestions** to find patterns in existing folders and members, then save only the checked suggestions.
5. Search the rules table, select rows for bulk enable, disable, delete or export, and use each row's **Actions** menu to edit or move it. Drag the handle to reorder, or focus it and use the Up/Down arrow keys.
6. Open **Rule Tester** to test one item, inspect conflicts and preview all assignments. Apply previewed assignments only after reviewing the plan.

Legacy folder regex remains compatible for imports and existing installations, but new automation should use Advanced Auto-Rules. See [Migration Guide](MIGRATION_GUIDE.md) before converting legacy regex rules.

## Bulk assignment and templates

Use `Advanced -> Bulk assignment` when many members need to move at once. Bulk plans are validated as one operation and committed atomically, so an invalid target blocks the complete batch instead of leaving a partial move.

1. Choose **Docker** or **VM**, then select the destination folder in the sidebar.
2. Select members in the table. Search by name or filter by current folder and status; click a column heading to sort. Both search boxes control the same search. **Select all**, **Clear**, and **Invert** affect the rows currently shown. Selections hidden by filters remain selected and are counted in the footer; clear the filters to review them.
3. Check the selected count, destination, and planned moves in the footer. Members already in the destination are counted as selected but do not add a move. Expand **Review planned changes** for the detailed plan, then click **Move containers** or **Move VMs** and confirm.

A safety snapshot is created before saving. The results identify failed members and offer **Retry failed** when needed; the existing undo action restores the safety snapshot. Switching Docker/VM preserves each source's destination and selection during the current page visit. The table shows **Unknown** when a saved member has no available runtime inventory entry. On phones, the destination and filters appear above the table and the move button spans the footer.

Templates save reusable folder settings. Review member-bound custom actions when copying or applying a template because actions that depend on unavailable members are disabled for safety.

In **Advanced -> Operations**, choose Docker or VM, a folder, and an action, then **Preview**. **Apply action** requires a current preview with eligible members. Changing the folder, action, or plan requires another preview. The separate template library supports name search and saving settings from a folder.

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

The Recovery summary shows readiness and policy for the selected source. Select a history row to restore, download, or delete that snapshot. New setups enable scheduled backups every hour with retention of 25 snapshots; existing saved schedules retain their settings. Interval accepts 1–168 hours and retention 1–200. Routine moves, reorders, preference changes, and pins do not create individual snapshots. Restore recovers preferences alongside folders when present; older folder-only snapshots keep current preferences.

Choose **Compare Snapshots** to open the snapshot chooser for the selected Docker or VM source. Select the **From snapshot** and **Compare with** targets; the second target can be another snapshot or **Current live folders**. Leave **Include preference changes** enabled to compare saved preferences as well.

The results show the two sources, folder totals, and **Added**, **Changed**, **Removed**, and **Unchanged** counts. Folder changes are shown from the first source to the second. Expand **View changed values** to inspect a changed folder's values, and review preference differences in their own section. **Compare again** returns to the chooser with your selections. Comparison is a preview and does not restore or save configuration.

Safety backups are created before supported imports, restores, bulk changes, and other destructive workflows. Keep an external export before uninstalling or replacing the USB configuration because plugin-local backups live under the plugin configuration directory.

## Docker start order

`Advanced -> Docker start order` can follow the Docker page folder order or define custom startup batches. Custom plans can specify groups, members, and delays. Always preview and validate a changed plan before syncing it to the host.

## Performance profiles

Docker and VM runtime settings provide three profiles:

- **Standard** keeps normal motion and refresh behavior and does not impose a profile-specific expansion cap.
- **Adaptive** is recommended for most servers. It increases safeguards when library size or measured render cost indicates a larger workload.
- **Maximum** uses reduced motion, deferred preview work, the smallest expansion restore limit, and the longest minimum refresh interval.

These profiles change presentation and refresh work; they do not remove configured members or disable collapsed previews. See [Runtime Performance Budgets](runtime-performance-budgets.md) for the enforced benchmark model.

## Privacy mode

The Docker-page Privacy toggle hides selected values without changing the stored Docker configuration. Its adjacent options menu controls individual masks. Settings provides the same saved choices. See [Privacy Guide](PRIVACY.md) for the exact fields and the difference between runtime masking and support-bundle sanitization.

## Diagnostics and support

**Advanced -> Logs** shows completed actions, issues, and selected recovery events in a compact newest-first feed. The current browser keeps up to 100 entries for 30 days. **Clear** removes the saved feed and prevents cleared server events from reappearing; it does not undo configuration changes. Routine background diagnostic successes are omitted.

Open `Advanced -> Diagnostics` to run health checks, inspect core and advisory results, copy an issue report, and preview or export a support bundle. Use a sanitized bundle for public reports unless raw values are explicitly required.

**Report issue on GitHub**, beside **Export support bundle**, opens the GitHub issue forms in a separate tab and keeps Diagnostics available. Review the sanitized preview and export a bundle before attaching it to your report. Opening the shortcut does not create an issue or upload diagnostic data automatically.

**Backup readiness** checks snapshot metadata and age without performing a restore. **Live runtime connectivity** reflects the latest health check of enabled Docker/VM services. Disabled services and insufficient evidence are informational. Docker startup diagnostics include aggregate stage timings without workload identities.

When a runtime page shows an error banner, copy its diagnostics before refreshing. See [Troubleshooting](TROUBLESHOOTING.md) for targeted checks and [Compatibility](COMPATIBILITY.md) for supported environments.
