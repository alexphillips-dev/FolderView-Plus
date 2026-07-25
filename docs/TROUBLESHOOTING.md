# Troubleshooting

Use this when the root README quick fixes are not enough.

## Common Issues

### Settings Page Is Blank

1. Refresh once with `Ctrl+F5`.
2. Reopen `Settings -> FolderView Plus`.
3. If it is still blank, open the browser console and share the console error or a screenshot of the failure.

### Runtime Banner On Docker Or VMs

Use the banner `Copy diagnostics` action. The banner is there to show bootstrap, request, or host-page problems clearly.

### Folder Editor Opens Blank

Copy the bootstrap diagnostics shown at the top of the editor. The modern editor exposes copyable bootstrap details when it cannot load the selected folder.

### Safe-Mode Banner

FolderView Plus auto-detects conflicting legacy Folder View runtimes.

1. Keep FolderView Plus installed.
2. Remove only the conflicting runtime plugin.
3. Refresh the Unraid UI after plugin changes.

### Compose Manager Is Installed

FolderView Plus isolates its Docker runtime to avoid the old shared-page symbol collision. If the Docker page still shows a runtime banner, copy diagnostics from the banner instead of guessing which plugin failed.

### Updates Do Not Appear Immediately

1. Run `Plugins -> Check for Updates`.
2. Compare the installed version with the selected `main` or `dev` manifest.
3. If Unraid reports `not reinstalling same version`, no newer version is published on that selected branch.
4. If a maintainer asks you to test a specific commit, install once from its commit URL, then return to normal `main` or `dev` tracking.

```text
https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/<commit>/folderview.plus.plg
```

Do not edit `/boot/config/plugins/folderview.plus/version` to force an update. See [Installation and Upgrades](INSTALLATION_AND_UPGRADES.md#not-reinstalling-same-version).

### Import Fails Validation

Make sure Docker exports are imported into Docker and VM exports into VMs. Re-export with the latest plugin version if the file came from older tooling.

Use Preview only and inspect the changed-folder list. Higher schema versions, type mismatches, malformed folder records, and ambiguous hierarchy collisions are rejected instead of being applied partially. Legacy formats and behavior modes are explained in [Migration Guide](MIGRATION_GUIDE.md).

### Built-In Or Third-Party Icons Are Missing

The large third-party icon library is a separately versioned asset pack. A normal install downloads its archive to the flash device, verifies it, extracts a RAM cache, and activates the normal runtime link.

1. Open `Settings -> FolderView Plus -> Advanced -> Diagnostics`.
2. Check the Custom Icons and build/package details for icon-pack version, readiness, and link state.
3. Confirm `/boot/config/plugins/folderview.plus/folderview.plus-icons-<version>.txz` exists.
4. Reinstall the current plugin manifest so the activation helper verifies and rebuilds the runtime cache.
5. Hard-refresh the browser after a successful activation.

Do not manually replace the runtime symlink with copied icon files. If activation still fails, export a sanitized support bundle and include the complete plugin installation output. See [Installation and Upgrades](INSTALLATION_AND_UPGRADES.md#versioned-icon-asset-pack).

User-uploaded icons are separate from the asset pack. Their persistent source is beneath `/boot/config/plugins/folderview.plus/images/custom`; if that directory was absent from a USB backup, reinstalling the built-in asset pack cannot restore those uploads.

### Collapsed Folders Are Blank

1. Expand the folder and verify its native members still exist.
2. Open the modern folder editor and check the Preview tab.
3. Confirm at least one included member has `Show in preview` enabled.
4. If child folders should appear, confirm child-folder previews and the intended depth are enabled.
5. Switch the performance profile to Adaptive or Standard temporarily and refresh.

Standard, Adaptive, and Maximum must preserve configured preview content. If only expanded rows appear, copy runtime diagnostics and attach a sanitized support bundle before changing the folder membership.

### Native Rows Briefly Appear Before Folders

This is expected during initial Docker or VM bootstrap. FolderView Plus lets Unraid render its native rows first, then performs one uninterrupted folder conversion. The page should not remain half grouped or paint folder rows one at a time.

If the page remains in Host list, confirm the selected View mode is FolderView. If the layout repeatedly changes between native and grouped views, capture runtime diagnostics because a host refresh or third-party page mutation may be retriggering bootstrap.

### Folder Rows Refresh Repeatedly

Start, stop, pause, resume, and update operations should reconcile only affected runtime rows. During Update All, bounded follow-up checks can continue until Unraid reports settled state, but they must stop afterward.

If rows keep refreshing indefinitely:

1. Wait for every native update dialog or notification to finish.
2. Record whether the operation was a single lifecycle action, folder action, or Update All.
3. Copy Docker runtime diagnostics before refreshing.
4. Export a sanitized support bundle.
5. Refresh once to stop the stale browser session and include the approximate duration in the report.

### Host List Or View Switching Looks Wrong

Host list should restore one copy of every native Unraid Docker row. FolderView should then rebuild one copy of every saved folder row. If rows duplicate, disappear, or a selection appears to do nothing:

1. Select `Reset view` to clear temporary toolbar filters.
2. Select Host list and confirm the native row count.
3. Select FolderView once and wait for conversion to complete.
4. Copy runtime diagnostics if duplicates remain.

Do not repeatedly switch views while an Update All operation is still reconciling.

### Dashboard Cards Or Names Are Clipped

Dashboard layout problems must be captured on the affected Dashboard because a support bundle exported later from Settings cannot reconstruct the earlier viewport or rendered card geometry.

1. Open Dashboard in the browser and device where the problem occurs.
2. Expand the affected Docker or VM folder and reproduce the clipping.
3. Open the widget's `View options` menu and select `Capture layout diagnostics`.
4. If orientation or browser zoom changes the result, capture once in each failing state. The bounded history keeps the distinct layouts.
5. Return to `Settings -> FolderView Plus -> Advanced -> Diagnostics`.
6. Confirm the support-bundle preview shows a fresh Docker or VM Dashboard capture, then export a sanitized bundle.

The capture records viewport, touch capability, orientation, browser scale, widget/card widths, expected/applied/rendered grid columns, overflow counts, and a layout verdict. It also distinguishes deliberate ellipsis from unexpected clipping. A capture older than 30 minutes, made on another plugin version, or made in a different viewport/input class is identified in the preview instead of being presented as current evidence.

### Privacy Choice Is Not Applied

An individual mask only takes effect while Privacy is enabled. Verify both the main Privacy toggle and the specific option.

- `Mask LAN IPs` controls only the IP portion of Docker `LAN IP:PORT`.
- `Mask ports` controls the port portion independently.
- Names and icons in collapsed previews use the same saved name/icon mask.

Toggle the affected option once, refresh, and confirm the main Privacy state persisted. If it still fails, report the exact surface and field without publishing the unmasked value. See [Privacy Guide](PRIVACY.md).

### Settings Or Runtime Is Slow

Use Adaptive for normal installations and Maximum for very large libraries or constrained browsers. Diagnostics distinguishes repeated warm performance overruns from isolated cold loads. A single cold-load observation is informational; repeated warm overruns can request follow-up.

Disable custom CSS and JavaScript overrides temporarily and retest. Include folder/member counts and the performance diagnostic card in a support report. The project benchmark contract is documented in [Runtime Performance Budgets](runtime-performance-budgets.md).

## Support Bundles

Open `Settings -> FolderView Plus -> Advanced -> Diagnostics`, then review the support bundle preview before export.

Use the sanitized export by default. It omits or hashes names, paths, URLs, IPs, and user-agent values and records what was redacted in the v2 `redactionManifest`.

The v2 bundle also includes exact build/package identity, loaded plugin script/style URLs and version queries, recent plugin actions, a bounded FolderView Plus API error-log tail, and browser-side JS error snapshots.

To compare two systems without exposing their identities, export sanitized bundles from both and run:

```bash
npm run compare:support-bundles -- first-bundle.json second-bundle.json
```

The comparator refuses full bundles and reports only allowlisted versions, counts, health/status, rendering geometry, modes, and other bounded troubleshooting fields.

It also includes bounded Dashboard visual-layout snapshots. Its troubleshooting-domain summary keeps layout/rendering evidence separate from configuration, runtime/request, storage, icon, theme, localization, and update findings.

Share the full export only if you intentionally need raw troubleshooting fields.

Runtime privacy masking and support-bundle sanitization are separate systems. Enabling Privacy does not sanitize a configuration export, and disabling Privacy does not make a sanitized support bundle raw. See [Privacy Guide](PRIVACY.md).

## Paths

- Config root: `/boot/config/plugins/folderview.plus`
- Custom CSS: `/boot/config/plugins/folderview.plus/styles`
- Custom JS: `/boot/config/plugins/folderview.plus/scripts`
- Third-party icons: `/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons`
- User-uploaded icons: `/usr/local/emhttp/plugins/folderview.plus/images/custom`

The `/usr/local` paths are active runtime locations. Persistent user configuration, custom icons, overrides, and plugin-local backups live beneath `/boot/config/plugins/folderview.plus`. Uninstalling the plugin deletes that persistent root, so export important configuration first.

## Legacy CSS/JS Overrides

FolderView Plus keeps legacy override directory support so older custom tweaks can continue working.

Supported legacy override roots:

- `/boot/config/plugins/folder.view/styles`
- `/boot/config/plugins/folder.view2/styles`
- `/boot/config/plugins/folder.view3/styles`
- `/boot/config/plugins/folder.view/scripts`
- `/boot/config/plugins/folder.view2/scripts`
- `/boot/config/plugins/folder.view3/scripts`

File naming rules:

- Docker page overrides: `*.docker.css` and `*.docker.js`
- VM page overrides: `*.vm.css` and `*.vm.js`
- Dashboard overrides: `*.dashboard.css` and `*.dashboard.js`
- Disable any override file by appending `.disabled`

Recommended migration path:

1. Copy legacy overrides into `/boot/config/plugins/folderview.plus/styles` and `/boot/config/plugins/folderview.plus/scripts`.
2. Keep the same filenames where possible.
3. Hard-refresh the browser after saving (`Ctrl+F5`).

Stable selector and migration policy: [SUPPORT_POLICY.md](SUPPORT_POLICY.md)
