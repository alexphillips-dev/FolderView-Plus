# Architecture Overview

FolderView Plus is an Unraid webGUI plugin with PHP endpoints, browser runtimes for several host surfaces, persistent JSON configuration on the flash device, and generated release packages. The project uses shared contracts so Docker, VM, Dashboard, Settings, and the modern folder editor do not each invent their own storage, request, UI, or runtime behavior.

## Major layers

| Layer | Responsibility |
| --- | --- |
| Unraid page integration | Loads FolderView Plus assets into Settings, Docker, VM, Dashboard, and folder-editor pages. |
| Host adapters | Discover native tables and rows, observe host mutations, and expose lifecycle hooks without leaking Docker-specific assumptions into VM code. |
| Runtime state | Normalizes Docker/VM inventory, builds folder membership, renders grouped views, and reconciles lifecycle changes incrementally. |
| Settings and editor | Edits folders and preferences, previews changes, and invokes guarded workflows. |
| Shared request client | Adds tokens and trace IDs, normalizes encoding, timeouts, parsing, errors, retries, uploads, and keepalive behavior. |
| Endpoint contract | Declares methods, mutation status, guards, content types, request limits, parameters, response types, and audit categories. |
| Durable storage | Validates and atomically commits configuration and recovery data with last-good support and failure reporting. |
| Shared UI primitives | Owns common buttons, fields, disclosures, dialogs, confirmations, badges, toasts, progress, empty, and loading states. |
| Localization | Loads versioned namespace catalogs with English fallback and generated legacy-surface coverage. |
| Diagnostics | Joins build identity, health, runtime, storage, localization, theme, telemetry, and sanitized support data. |
| Packaging | Produces the versioned core archive and pins the independently versioned icon asset pack. |

## Request flow

1. A page uses the shared browser request client.
2. The client attaches request protection and trace metadata.
3. The PHP endpoint resolves its declaration from `server/api-endpoints.json`.
4. The shared endpoint runtime enforces method, content type, request size, required parameters, mutation guard, and response expectations.
5. The handler validates the domain operation.
6. Durable mutations are committed through the shared storage service.
7. The response and activity records retain trace, transaction, and audit context.

See [API Endpoint Contract](api-endpoint-contract.md) and [Durable Storage](durable-storage.md).

## Runtime flow

Docker and VM pages use the shared host-adapter contract to find native structures and rows. FolderView Plus leaves native host rows available during bootstrap, obtains a coherent runtime snapshot, and converts the visible layout without yielding a partially grouped folder tree. Later lifecycle changes are reconciled incrementally when structural configuration has not changed.

The Dashboard consumes the same normalized folder and inventory contracts but renders cards rather than native table rows. Shared folder and preview models keep membership, status, ordering, and collapsed-preview behavior consistent across these surfaces.

See [Runtime Host Adapter](runtime-host-adapter.md), [Docker Runtime Architecture](docker-runtime-architecture.md), and [VM Runtime Architecture](vm-runtime-architecture.md).

## Configuration and recovery

Docker and VM folder maps and preferences remain separate logical types. Metadata sidecars track revisions while preserving the established configuration payload shapes. Batch changes validate the entire plan and commit once. Backups, rollback snapshots, imports, restores, and configuration mutations use the same storage foundation.

Durable writes use sibling temporary files, flush where supported, and rename into place. Last-good mirrors provide a recovery source without treating logs and disposable runtime caches as transactional configuration.

## UI and theme model

`folderviewplus.ui.js` and `ui.primitives.css` define common controls and dialog behavior. Managed dialogs own focus trapping, Escape/backdrop policy, scroll locking, stacking, live announcements, and focus restoration. New static actions use delegated `data-fv-ui-action` bindings rather than adding inline event handlers.

Surface-specific styles compose shared primitives with documented theme tokens. A downward-only UI debt guard prevents growth in first-party `!important` declarations, SweetAlert references, and inline handlers while older surfaces are migrated.

See [Shared UI Primitives](shared-ui-primitives.md), [Theme Guide](THEME_GUIDE.md), and [Theme API Contract](THEME_API_CONTRACT.md).

## Performance model

Runtime profiles resolve to Standard, Adaptive, or Maximum behavior. Performance is validated with deterministic small, normal, and extreme browser fixtures measuring native-row visibility, grouping, Settings bootstrap, editor opening, reconciliation, DOM size, observer callbacks, heap retention, and bootstrap requests.

Static asset budgets remain useful but do not substitute for runtime benchmarks. See [Runtime Performance Budgets](runtime-performance-budgets.md).

## Localization model

English provides the versioned source catalog and fallback. Modern messages are divided into namespaces, while a generated legacy-surface catalog covers remaining static and dynamically inserted UI text. Extraction and usage guards prevent newly introduced user-facing text from bypassing the catalog.

See [Translating FolderView Plus](TRANSLATING.md) and [Translation Platform Setup](TRANSLATION_PLATFORM.md).

## Documentation contracts

`docs/current-state.json` records a small set of public feature names and behavior contracts. The documentation guard compares that metadata with live Settings and runtime source, checks public guide discovery, and rejects explicitly retired terms. This is intentionally narrower than duplicating the entire implementation in metadata.

When a guarded feature name changes, update its implementation, current-state metadata, affected guides, tests, and release notes in the same change.

## Packaging and releases

The core plugin archive contains the installed runtime but excludes the large third-party icon library. The manifest pins a separate immutable icon asset pack by version and checksums. The installer verifies, stages, and activates that pack at the existing public icon path.

Development happens on `dev`; `main` represents the stable release. The shared CI suite drives lint, tests, guards, fixture browsers, and configured live smoke lanes. Stable release preparation rebuilds and validates the package before publishing.

See [Versioned Asset Packs](../asset-packs/README.md), [Contributing](../.github/CONTRIBUTING.md), and [Installation and Upgrades](INSTALLATION_AND_UPGRADES.md).
