# ADR 0004: Diagnostics Privacy Invariants

Status: accepted

Sanitized support bundles are the default public troubleshooting artifact. Names, identifiers, paths, addresses, URLs, request metadata, and oversized collections must be hashed, masked, omitted, or truncated before export.

Comparison tooling may compare sanitized structure and fingerprints but must not attempt to reverse or label hashes as identities.

Enforcement: support-bundle redactors, privacy self-checks, bundle schema tests, and comparator tests.

Folder editor evidence uses the existing UI-state collector under `uiTelemetry.uiState.channels.editor.docker` and `.vm`. Each type retains at most eight snapshots for 30 minutes, including capture time and plugin version. Records survive navigation to Settings when browser storage is available; blocked storage uses an in-memory fallback on the current page. Snapshots from a different plugin version are marked with `versionMismatch`.

Editor records contain fixed workflow/reason categories, the active icon-source tab, selection-comparison booleans, upload and cancellation counters, disabled-control/help counts, and layout measurements. Geometry sampling is limited to 32 cards in the active icon source. Theme, direction, viewport, and pointer mode describe the editor at capture time. Hovering a help icon does not generate telemetry. Icon URLs, filenames, search text, form values, tooltip text, and DOM contents are excluded in both sanitized and full bundles.

FolderView3 activity records use allowlisted outcome/rollback codes, counts, and verification/checkpoint flags. Rejected previews and applies may append diagnostics history while leaving folder, preference, theme, and native autostart configuration unchanged. Requested native-autostart changes are distinguished from changes that were actually verified. Transaction observers and diagnostics writes are non-fatal; they cannot prevent compensation or convert a verified migration into a failure.
