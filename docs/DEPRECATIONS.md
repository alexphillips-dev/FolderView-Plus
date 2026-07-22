# Deprecations and Compatibility Aliases

The machine-readable source of truth is `schemas/deprecations.schema.json` in the shipped plugin. CI validates that compatibility reads remain implemented, replacement settings exist, deprecated settings are not presented as new UI choices, and removed tokens do not return to live plugin code.

## Active compatibility

- `performanceMode` remains readable for older preference files. New code and UI use `performanceProfile`; saves derive the compatibility boolean from the selected profile.
- `dashboard.privacyMaskContainerIps` remains readable for older profiles. It is hidden from the settings UI; new configuration uses `dashboard.privacyMaskLocalIps`.
- Folder-level `regex` is deprecated for new automation in favor of Advanced Auto-Rules. Existing regex values remain supported for runtime, import, export, backup, and guarded conversion. This is not a removal notice.

## Removed no-op preferences

- The Health cards “Compact card layout” preference was removed because it no longer had a distinct supported behavior.
- `folderEditorMode` and `folderEditorModeExplicit` were removed from normalization and output after the retired editor path was deleted.

Removal of an active compatibility contract still follows the two-stable-release minimum in [Support Policy](SUPPORT_POLICY.md).
