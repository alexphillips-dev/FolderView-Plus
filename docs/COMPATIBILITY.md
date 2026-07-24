# Compatibility

This page describes the supported environment and the boundaries between FolderView Plus, Unraid, browsers, themes, legacy Folder View installations, and optional integrations.

## Supported platform

| Component | Support |
| --- | --- |
| Unraid | 7.0.0 or newer |
| Docker | Supported through the standard Unraid Docker page and APIs |
| VMs | Supported when the Unraid VM/libvirt surface is available |
| Dashboard | Supported for FolderView Plus Docker and VM folder rendering |
| Browser | Current major Chrome, Edge, Firefox, or Safari |
| Input | Mouse, keyboard, and responsive touch layouts are covered by project contracts |

FolderView Plus is built against the standard Unraid webGUI structure. Diagnostics reports a host-compatibility problem when required native page elements or APIs are unavailable instead of silently assuming the page is valid.

## Runtime surfaces

### Docker

The Docker page supports FolderView, Host list, and Command views. FolderView groups native rows; Host list restores the standard Unraid table; Command provides an alternate FolderView-owned control surface. FolderView Plus observes native lifecycle and update activity and reconciles affected rows incrementally.

### VMs

The VM runtime uses the shared host-adapter contract with VM-specific row and lifecycle handling. If libvirt or the native VM page is unavailable, the VM configuration can remain stored but runtime controls cannot operate.

### Dashboard

Dashboard cards use the saved Docker and VM folder configuration and current runtime snapshots. Dashboard display settings do not create a third independent folder map.

## Performance profiles

Docker and VM use the same three user-selectable profiles:

- Standard
- Adaptive (recommended)
- Maximum performance

The profile can alter refresh cadence, motion, deferred preview work, and restored expansion limits. It must not erase folder membership or suppress configured collapsed previews. Internal threshold state is not a separate user-facing mode.

## Legacy Folder View compatibility

The project maintains compatibility with:

- FolderView2 and FolderView3 import payloads.
- Recognized older single-folder and wrapped export shapes.
- Docker label keys from `folder.view`, `folder.view2`, `folder.view3`, and `folderview.plus`.
- Existing folder-level legacy regex.
- Legacy custom override directories.
- Stable runtime selectors listed in [Support Policy](SUPPORT_POLICY.md).

Legacy compatibility is tested, but the old plugin runtime should not remain active on the same host page. FolderView Plus can enter safe mode when a conflicting legacy runtime is detected. See [Migration Guide](MIGRATION_GUIDE.md).

## Optional integrations

### Compose Manager

FolderView Plus isolates its Docker runtime and supports Compose-related matching data where available. Compose project auto-rules can use recognized Compose labels and fallbacks. Compose Manager remains a separate plugin; FolderView Plus does not manage its installation or guarantee compatibility with every future page override it may introduce.

### Custom themes

FolderView Plus uses shared theme tokens and tests normal dark/light behavior. Themes that replace native table markup, force global styles, or override focus and dialog behavior can still expose incompatibilities. Use the theme diagnostics and test once without custom overrides before reporting a core rendering issue.

### Custom CSS and JavaScript

Current and legacy override roots remain supported according to [Support Policy](SUPPORT_POLICY.md). Stable selectors are protected by contract tests, but undocumented internal classes and DOM structure may change. New customization should use documented hooks and theme tokens from [Theme Guide](THEME_GUIDE.md) and [Theme API Contract](THEME_API_CONTRACT.md).

## Import and export compatibility

Current schema exports include explicit type and schema metadata. Docker and VM types are not interchangeable. Higher schema versions are rejected rather than applied speculatively. Legacy schemas are normalized conservatively, and malformed or ambiguous hierarchy data is reported during preview.

Exports created by a newer plugin may contain fields an older plugin does not understand. Downgrades should therefore be treated as a recovery operation, not a guaranteed round trip. See [Installation and Upgrades](INSTALLATION_AND_UPGRADES.md#downgrades).

## Localization

English is the source and fallback language. Shipped locales resolve through versioned catalogs and can fall back to English for a missing key. Regional tags and right-to-left direction are handled by the localization runtime. Translation maintenance is documented in [Translating FolderView Plus](TRANSLATING.md).

## Support boundaries

FolderView Plus supports its own PHP endpoints, browser scripts, settings, folder data, import/export, recovery, packaged assets, and documented integration hooks. It cannot correct:

- Unraid core defects outside the plugin surface.
- Broken Docker containers, VM definitions, storage, or networking.
- Third-party theme or plugin code that replaces required host behavior.
- Unsupported browsers or stale cached assets outside the plugin's control.
- Manual edits that leave persistent JSON internally inconsistent.

Even when the source of a problem is external, a sanitized support bundle can help identify the boundary. Use [Troubleshooting](TROUBLESHOOTING.md) before opening a report.
