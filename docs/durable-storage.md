# Durable storage policy

FolderView Plus routes configuration and recovery data through `writeDurableFileAtomic`, `writeJsonObjectAtomic`, or `writeJsonObjectWithLastGood` in `server/lib.php`.

The service writes a sibling temporary file, flushes it, atomically renames it over the target, preserves the target mode, and attempts to flush the parent directory where the platform supports directory handles. JSON configuration with a recovery copy uses the same service for both the primary and `.lastgood` files. A failed primary commit is reported to the caller and its temporary file is removed. A failed last-good mirror does not invalidate an already committed primary file.

Every durable write records the current request trace and transaction IDs in its in-process storage result. Configuration metadata, backup and rollback payloads, diagnostics activity, API responses, and support bundles carry the same IDs so a mutation can be followed end to end.

## Direct-write classification

The remaining direct `file_put_contents` calls are deliberately outside the durable transaction service:

| Location | Classification | Reason |
| --- | --- | --- |
| `lib.php` debug startup and `fv3_debug_log` | Log | Append-only troubleshooting output in `/tmp`; losing it cannot change plugin state. |
| `lib.php` `fv3_write_json_cache_payload` | Disposable cache | Rebuilt from Docker/VM host data. |
| `lib.php` `writeReadInfoCache` | Disposable cache | Short-lived runtime response cache that can be discarded. |
| `lib.php` `fvplus_log_api_exception` | Log | Append-only error log; never read as configuration. |
| `lib.php` `markDockerSyncOrderPending` | Disposable coordination marker | A coalescing hint; a later sync recreates it. |
| `third_party_icons.php` `writeThirdPartyIconCache` | Disposable cache | Rebuilt by rescanning third-party icons. |
| `upload_custom_icon.php` `writeCustomIconUploadRateBucket` | Disposable rate-limit cache | Temporary abuse-control state, not user configuration. |
| `upload_custom_icon.php` SVG normalization and `writeInlineIconTempFile` | Temporary upload staging | Removed after validation; the final icon bytes and metadata use durable storage. |

`tests/durable-storage-service.test.mjs` enforces this allowlist. A new direct PHP write fails the test until it is either routed through the service or explicitly classified here and in the test.

## Failure testing

Tests enable storage failure injection only with `FVPLUS_STORAGE_FAILURE_INJECTION=1`. Supported stages cover parent creation, read-only storage, temporary-file creation, temporary writes, interrupted writes, full disks, file flush, rename, directory flush, and the last-good mirror. Injection is disabled in normal plugin execution even if a stage name is present.
