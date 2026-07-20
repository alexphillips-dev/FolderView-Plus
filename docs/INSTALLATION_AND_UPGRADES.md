# Installation and Upgrades

FolderView Plus supports Unraid 7.0.0 or newer. Install the stable branch for normal use and the dev branch only when testing an unreleased fix.

## Install the stable release

Open `Plugins -> Install Plugin` and use:

```bash
plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg
```

The same command can be run from an Unraid terminal. After installation, open `Settings -> FolderView Plus` and use the Setup Assistant or Basic settings.

## Installation report

Unraid prints its own download, verification, package-manager, and hook lines. FolderView Plus then prints a compact final report that identifies whether the operation was an installation, upgrade, reinstall, or downgrade and shows:

- Previous and current versions where applicable.
- Core package status.
- Icon-pack version, verification result, cache reuse or activation, and icon count.
- Whether configuration, backups, custom icons, and overrides were preserved or initialized.
- Scheduled-backup registration status.
- Elapsed installation time and the recommended next step.

The core archive includes a Slackware package description, so the package manager's `PACKAGE DESCRIPTION` section identifies FolderView Plus instead of remaining blank. A failed FolderView Plus stage prints the stage, exit code, available error detail, and previous installed version without printing a success report.

## Install the dev build

The dev branch can change frequently and is intended for directed testing:

```bash
plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg
```

The installed manifest retains the branch-specific update URL. Install the stable manifest again when testing is complete and you want to return to stable tracking.

## Normal updates

Use `Plugins -> Check for Updates`, then install the available FolderView Plus update. A normal update:

- Replaces the runtime package under `/usr/local/emhttp/plugins/folderview.plus`.
- Keeps configuration under `/boot/config/plugins/folderview.plus`.
- Downloads or reuses the pinned icon asset pack.
- Recreates the scheduled-backup cron entry.
- Removes older core package archives after the new package is installed.

Reload the affected browser page after an update. FolderView Plus emits versioned assets and a page-version sentinel, but a hard refresh with `Ctrl+F5` is still useful when the browser or an intermediary cache serves stale markup.

## “Not reinstalling same version”

Unraid will not reinstall a manifest whose version is identical to the installed version. This is expected and is not an installation failure.

1. Confirm the version shown in `Plugins`.
2. Confirm whether the installed plugin tracks `main` or `dev`.
3. Check that the branch manifest contains a newer version.
4. Use `Plugins -> Check for Updates` again after the new manifest is published.

When testing a specific repository commit, install its manifest once:

```bash
plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/<commit>/folderview.plus.plg
```

Replace `<commit>` with the requested commit SHA. The referenced package artifacts must still exist on the branch encoded by that manifest. Return to the normal `main` or `dev` URL after the test.

Do not edit the installed version file to bypass Unraid's version comparison. That produces an installation state that diagnostics and update checks cannot identify reliably.

## Versioned icon asset pack

The built-in third-party icon library is distributed separately from the frequently updated core plugin package. The manifest pins its version and checksums. Installation verifies the pack, keeps the downloaded archive on the flash device, extracts it into a versioned RAM cache, and links the normal runtime icon path to that active cache.

- Persistent archive: `/boot/config/plugins/folderview.plus/folderview.plus-icons-<version>.txz`
- Active cache: `/tmp/folderview.plus-assets/icons-<version>`
- Runtime link: `/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons`

Rebooting clears the RAM cache; the installer recreates it from the persistent verified archive. A core plugin update normally reuses an unchanged pack instead of downloading thousands of icon files again.

If activation fails, the plugin installer reports an error instead of silently completing. See [Troubleshooting](TROUBLESHOOTING.md#built-in-or-third-party-icons-are-missing).

## USB restore or replacement

FolderView Plus configuration is stored on the Unraid flash device. After restoring or replacing the USB configuration:

1. Confirm `/boot/config/plugins/folderview.plus` was restored.
2. Install the correct stable or dev manifest.
3. Allow the installer to verify and reactivate the icon pack.
4. Open Settings and run Diagnostics.
5. Verify Docker and VM folders before applying any import or restore.

If the plugin directory was not included in the USB backup, restore from an external FolderView Plus export. Plugin-local backups cannot help when their entire configuration directory was lost.

## Configuration and data locations

Persistent data is rooted at `/boot/config/plugins/folderview.plus`. It includes folder maps, preferences, metadata and recovery copies, backups, rollback snapshots, custom icons, and custom scripts or styles.

Runtime files under `/usr/local/emhttp/plugins/folderview.plus` are installed package content and are rebuilt during installation. Files under `/tmp/folderview.plus-assets` and `/tmp/folderview.plus-cache` are disposable runtime caches.

Do not manually copy a live temporary file over a persistent configuration file. Use export, import, backup, and restore workflows so validation, safety snapshots, metadata revisions, and activity records remain coherent.

## Before upgrading across major behavior changes

1. Export Docker and VM configuration.
2. Create a manual Recovery snapshot.
3. Save the exported files outside the Unraid flash device.
4. Read the release notes for migrations or deprecations.
5. Update the plugin.
6. Verify Settings, Docker, VMs, Dashboard, privacy choices, custom icons, rules, and start order.
7. Export a sanitized support bundle if anything differs unexpectedly.

## Downgrades

Downgrades are not guaranteed to understand configuration fields introduced by a newer release. Before installing an older version:

- Export the current configuration.
- Preserve a copy of `/boot/config/plugins/folderview.plus` outside the server.
- Review release notes between the two versions.
- Expect newer settings to be ignored or normalized by older code.
- Avoid saving extensively from the older version until the required behavior is verified.

Returning to the latest version and restoring the pre-downgrade export is safer than manually editing folder or preference JSON.

## Uninstall

Export anything you want to retain before uninstalling. The plugin remove action deletes `/boot/config/plugins/folderview.plus` and therefore removes:

- The installed runtime package.
- `/boot/config/plugins/folderview.plus` and all configuration stored beneath it.
- Plugin-local backups and rollback data.
- Uploaded custom icons and custom overrides.
- The icon-pack archive and runtime cache.
- The scheduled-backup cron entry.

Uninstalling does not delete Docker containers, VMs, or their application data, but it does delete FolderView Plus organization and recovery data. A normal update is not an uninstall and preserves the persistent configuration directory.
