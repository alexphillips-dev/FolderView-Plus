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
2. If still cached, install once from a commit URL, then return to normal `main` or `dev` tracking.

```text
https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/<commit>/folderview.plus.plg
```

### Import Fails Validation

Make sure Docker exports are imported into Docker and VM exports into VMs. Re-export with the latest plugin version if the file came from older tooling.

## Support Bundles

Open `Settings -> FolderView Plus -> Advanced -> Diagnostics`, then review the support bundle preview before export.

Use the sanitized export by default. It omits or hashes names, paths, URLs, IPs, and user-agent values and records what was redacted in the v2 `redactionManifest`.

The v2 bundle also includes exact build/package identity, loaded plugin script/style URLs and version queries, recent plugin actions, a bounded FolderView Plus API error-log tail, and browser-side JS error snapshots.

Share the full export only if you intentionally need raw troubleshooting fields.

## Paths

- Config root: `/boot/config/plugins/folderview.plus`
- Custom CSS: `/boot/config/plugins/folderview.plus/styles`
- Custom JS: `/boot/config/plugins/folderview.plus/scripts`
- Third-party icons: `/usr/local/emhttp/plugins/folderview.plus/images/third-party-icons`
- User-uploaded icons: `/usr/local/emhttp/plugins/folderview.plus/images/custom`

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
