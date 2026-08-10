# ADR 0002: Browser Compatibility Boundary

Status: accepted

FolderView Plus uses classic browser scripts for supported Unraid webGUI versions. New modules publish one `FolderViewPlus*` namespace and retain narrow global shims only for Unraid host callbacks or documented compatibility.

Settings dependencies may be staged by the Settings loader, but the main runtime starts only after its declared dependency manifest resolves.

Enforcement: architecture schema, include-order guard, fixture browsers, and runtime lifecycle tests.
