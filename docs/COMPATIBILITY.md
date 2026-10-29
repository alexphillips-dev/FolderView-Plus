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

On the current table-based Unraid Docker page, FolderView Plus supports FolderView, Host list, and Command views. FolderView groups native rows; Host list restores the standard Unraid table; Command provides an alternate FolderView-owned control surface. FolderView Plus observes native lifecycle and update activity and reconciles affected rows incrementally.

FolderView Plus also detects Unraid's developing native Docker component by page capability. When that component owns the Docker page, FolderView Plus does not overlay a second folder system or call the prerelease organizer mutations. It leaves the native page untouched, preserves saved FolderView Plus data and unaffected surfaces, and records sanitized compatibility evidence. See [Unraid Docker Interface Compatibility](unraid-docker-interface-compatibility.md) and [Unraid Docker Prerelease Qualification](unraid-docker-prerelease-qualification.md).

On the current legacy Docker page, FolderView Plus uses a hybrid provider: schema-confirmed GraphQL reads and preview statistics are preferred when available, while Unraid's legacy host bridge continues to own lifecycle-button behavior and UI refresh. Older or unavailable API surfaces fall back to the existing DOM/PHP runtime. See [Unraid Docker API Integration](unraid-docker-api-integration.md).

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

Auto and Host theme compatibility modes inherit modern host text, accent, surface and button variables, including those supplied by Aurora Theme and NeoRaid. Safe and High Contrast modes remain available, and explicit folder status colors are preserved. See [Host Palette Inputs](THEME_API_CONTRACT.md#host-palette-inputs).

General adaptation also samples usable native computed styles when no page/card variable contract exists, follows native control metrics, and responds to stylesheet/font changes. Themes reports identity separately from adaptation. Synthetic fixtures cover multiple color, sizing and recovery contracts across all five plugin surfaces; they do not certify every third-party theme. Theme authors can use the [maintainer integration fixture](THEME_GUIDE.md#maintainer-integration-fixture) to check load order and renderer ownership.

**Aurora Theme:** Aurora release **2026.10.27.1922** recognizes `folderview.plus` and skips its competing Docker renderer and selected Dashboard handlers when Plus owns those surfaces. See the [reviewed upstream implementation](https://github.com/Tunefish92/Aurora-Theme/blob/c9e9063da644530fd5aa69921723e12a498c001c/plugin/src/scripts/enhance.js). Use current releases of both plugins and hard-refresh after updating. Palette adaptation and layout ownership remain separate contracts; this source review does not certify every host, theme option, or viewport.

Older Aurora builds that do not recognize Plus can move stored container rows or apply compact layouts to folder rows. For those builds, disabling **Settings → User Utilities → Aurora Theme → Page enhancements**, applying, and hard-refreshing remains a temporary comparison or workaround; colours, fonts, and navigation can remain enabled. Current Aurora builds do not require that blanket workaround solely because Plus is installed.

Stable FolderView Plus **2026.10.27.05** also corrects an independent idle Docker refresh loop caused by equivalent runtime responses arriving in different entry orders. Update Plus before attributing repeated column movement to the theme. If movement continues, reproduce it with the same view and theme settings, leave Docker visible long enough to record column movement, then export a sanitized support bundle from Settings. Theme maintainers should follow [Layout Ownership for Theme Integrations](THEME_API_CONTRACT.md#layout-ownership-for-theme-integrations).

**NeoRaid:** Compatibility fixtures use the actual stylesheet and theme-switching script from [NeoRaid 2026.10.27c](https://github.com/veaceslavmafteiaevoluta/neoraid/tree/0b9dded5ce781e20170b912938a0bb4b7ab48eb0). FolderView Plus recognizes its active same-origin color stylesheet and theme marker, follows live palette changes, and preserves Settings warning colors, toolbar alignment and native Sort hit areas. Sanitized theme diagnostics include only bounded active-mode, density, corner and font options. This fixture coverage does not certify every Unraid installation or theme-option combination; hard-refresh after updating and check Docker, VM, Dashboard and Settings with your chosen options.

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
