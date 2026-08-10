# Installed runtime integrity

Every FolderView Plus package contains `runtime-integrity.json`. The manifest is
generated after channel-specific package transformations and before archive
creation.

The manifest records SHA-256, byte size, and expected installed mode for:

- plugin page entrypoints;
- PHP endpoints and shared server libraries;
- browser runtime JavaScript;
- packaged shell/PHP helper scripts;
- plugin CSS; and
- critical runtime JSON metadata.

The manifest excludes itself and large passive asset collections. Package SHA-256
and GitHub attestations establish archive origin; the runtime manifest detects
changes after extraction.

Diagnostics compares the installed files with this manifest and reports:

- missing files;
- modified content;
- unexpected executable/runtime files;
- unreadable files; and
- changed permission modes.

Sanitized diagnostics hash finding paths. Full diagnostics can show the packaged
relative path. Integrity checking is detection-only: FolderView Plus never
silently restores, deletes, or replaces a finding. Reinstalling the same verified
package is the supported recovery action after the cause has been reviewed.
