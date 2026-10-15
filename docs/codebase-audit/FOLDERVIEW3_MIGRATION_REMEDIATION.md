# FolderView3 migration remediation

Implementation baseline: `dev` at `e199459cc6858481f6ee05b874f5bd525ac65694`. Target: development testing only, package `2026.10.13.07`. This report accompanies the implementation; the earlier local-only audit and diagnostic evidence are intentionally excluded from publication.

The compatibility reference is chodeus/folder.view3 commit `c111a74aba4ee62b1b64b2cfc0a14ab66fcc50ef`, including the historical introduction of its version-1 full exporter. Test exports are explicitly synthetic. The unchanged upstream PHP membership functions are retained, with their MIT notice, in a test-only fixture so ownership can be compared without a network dependency.

## Implementation and impact

The full converter validates the five required maps before planning. Missing required export sections are different from intentional empty maps; historical autostart, host-version and order additions remain optional. Field-specific limits replace the generic 250-entry cap for member, identity, hidden-preview and action-target collections. Unsupported or excessive values are rejected before replacement.

The converter materializes the effective settings previously inherited by existing legacy folders, maps overflow and highlighting, distinguishes Docker IDs from VM UUIDs and retains dynamic hidden preferences. It converts reusable appearance presets into inactive profiles and keeps notes/toggle/page assignments as inert recovery metadata. The active appearance profile is retained. No imported CSS, User Scripts or source-update configuration is executed by migration.

Full backups dispatch to the dedicated Recovery workflow. Per-type maps, single folders and native Plus imports retain their scoped contracts. Recovery presents replacement warnings, assignment/rule/profile counts, converted/unsupported setting counts, confirmation and verified transaction results. The dedicated picker enforces the pre-read byte limit and strict UTF-8 decoding. Invalid selection or expression parsing clears an older plan and reports an owned error. The controller rejects stale responses, replaces earlier document bindings, permits file-selection cancellation and refreshes Settings/Recovery after a verified apply. A disconnected controller cannot refresh or announce into a replacement view. A refresh failure is reported separately from persistence success.

Migrated folders carry `membershipPolicy: "folderview3"`; converted regex rules carry source provenance. A shared browser policy and equivalent backend policy reserve explicit members first, then valid Docker labels, then regex ownership in original source order. Persisted folder order remains a separate display/startup contract. Docker, VM and Dashboard caches, bulk actions, conflict reports and Docker startup consume this policy. Native Plus folders and advanced rules keep their existing behavior. Member order remains explicit-list order, followed by regex and label additions, matching the original evaluator.

Preview uses side-effect-free workspace inspection. Its digest covers meaningful source configuration and captured destination bytes, including native startup state; generated export timestamps are excluded. Apply checks the digest before the transaction and again while holding the existing mutation lock. The existing atomic writes, revisions, captured compensation, backups and global rollback checkpoints remain authoritative. Automatic raw FolderView3 adoption is disabled so it cannot bypass full validation or repopulate an intentionally empty migrated configuration; older FolderView2 adoption remains available.

The changed shared normalization paths also affect native imports, editor saves, backups and environment restore. Those consumers retain their APIs and now preserve the documented larger collections and hidden member references. Policy inspection tolerates malformed native records and uses actual runtime inventory so a member named like `folder-manual` is not lost through placeholder/order filtering. Architectural contracts register the focused new modules, inventories and load order; existing published file budgets are not increased. The browser harness inventories the added cases, and the CI selector includes the new shared policy in both production surface checks.

## Issue resolution matrix

All entries describe implemented behavior and local automated evidence. Live Unraid acceptance remains pending for every runtime-dependent entry.

| Finding | Severity | Implemented resolution and principal files/functions | Regression evidence | Remaining limits |
|---|---|---|---|---|
| FV3-001 | High | `lib.folderview3-validation.php`: strict envelope/version/map/record validation and duplicate-key rejection; decoder validates before planning. | Remediation malformed/version/depth/size tests; browser endpoint rejects a damaged full backup; exact preexisting file hashes remain unchanged. | Known version 1 only; malformed data must be corrected in a copy. |
| FV3-002 | High | `utils-transfer.js` recognizes the full marker before map parsing; `folderviewplus.js` and `settings-workspaces.js` route to migration; `FolderViewPlus.page` restores Recovery controls. | Scoped parser contracts, existing import compatibility suites and browser full-backup file picker/preview/apply. | Wizard accepts scoped exports and directs full backups to Recovery. |
| FV3-003 | High | `lib.php` field-specific collection/key limits; validation rejects over-limit input rather than truncating. | Exact 249/250/251/300/5000 member order, long identity keys, hidden lists and action targets; 5001 rejected unchanged. | Limits documented below; arbitrary extension collections retain the smaller generic limit. |
| FV3-004 | High | `membership.js`, `utils-rules.js`, runtime caches, `lib.folder-membership.php`, `lib.docker-order.php`: explicit migration policy shared by consumers. | PHP and browser policy outputs plus actual startup context equal the unchanged upstream evaluator across manual, label, regex and source-order changes; native advanced rules remain unchanged. | Host row rendering and native startup execution require Unraid acceptance. |
| FV3-005 | Medium | `fvplusFolderView3PreviewDigest` omits volatile exported timestamp and includes meaningful installed/destination state. | Separate installed reads across a timestamp boundary retain the digest and apply; edited installed settings reject stale review. | Meaningful source edits require a new preview. |
| FV3-006 | Medium | `fvplusFolderView3InspectWorkspace` reads primary or last-good data and normalizes in memory without recovery writes. | Missing, legacy and corrupt-with-last-good workspace previews leave every captured file unchanged. | Corrupt workspace without a valid copy requires explicit recovery. |
| FV3-007 | Medium | `fvplusFolderView3Overflow`: `0/default`, `1/expand`, `2/scroll` map to native equivalents for folders and defaults. | All numeric/string aliases and existing `expand_row` persist correctly; reload/readback assertions. | Actual host row expansion/scrolling/separators remain manual acceptance. |
| FV3-008 | Medium | `lib.folderview3-settings.php`: context trigger/graph/time and folder highlighting conversion; unsupported Dashboard/color-lock warnings and accounting. | Stored defaults/highlight checks, false/zero inheritance checks, warning and count assertions; localization checks. | Unsupported legacy effects are disclosed rather than recreated. |
| FV3-009 | Medium | `fvplusFolderView3BuildType` maps VM `containerIds[name]` into `memberIdentities[name].uuid`; editor mutation retains compatible references; the browser identity map handles PHP's JSON-list encoding for numeric member names. | Persist/reload, unique rename, numeric name `0`, temporarily missing and ambiguous UUID cases through the existing identity reconciler; editor re-save. | Ambiguous identities remain unresolved rather than guessed. |
| FV3-010 | Medium | Folder validation rejects invalid/oversized or unsupported expressions; conversion preserves original regex text. | Literal whitespace and invalid/oversized patterns; unchanged upstream evaluator comparison; backend/browser matching and existing regex suites. | Browser/PHP engines differ on advanced syntax; uncommon patterns may require correction. |
| FV3-011 | Medium | `normalizeFolderContentPayload` keeps bounded hidden names beyond explicit members; `folder.js` preserves the editor's hidden preference set, including visible rule-only and absent members. | Applied hidden regex references, large hidden lists, reload and the actual editor serialization block in all three browsers; identity/editor suites. | Live disappearance/return and rendered hidden state require host acceptance. |
| FV3-012 | Low | `lib.folderview3-presets.php` converts named presets and preserves notes/toggle/page assignments as `legacyMetadata`; PHP and browser theme normalizers retain bounded metadata. | Inactive preset/value and recovery-note readback through both normalizers; unsafe/oversized layers and profile exhaustion tests. | Original selectors may differ; source update metadata is never trusted as managed update configuration. |
| FV3-013 | Medium | `fvplusFolderView3DefaultSettings` and `FolderSettings` materialize missing/null/empty legacy inheritance without replacing explicit false/zero. | Persisted and default-profile checks for inherited null/empty values, explicit overrides, overflow aliases and editor identity/policy preservation. | Future changes to Plus defaults do not retroactively reintroduce legacy global inheritance. |

## Compatibility and exclusions

Full migration is a coordinated replacement of both folder maps and type preferences. It is not a merge. Existing Plus rules, groups, privacy/health/performance/default/backup-schedule settings can be replaced by converted/default values; preview and confirmation disclose replacement. The active theme profile is kept while imported profiles remain inactive.

Supported mappings include the original preview/context controls, Dashboard layout/expansion/grayscale/folder-label controls, future-folder defaults, explicit membership, Docker identity hints, VM UUID hints, hidden previews, action definitions, plugin startup ownership, saved folder order and safe scoped appearance data.

Unsupported Dashboard animation and container/folder highlighting, disabled/direct-WebUI Dashboard context modes and color locking are identified in warnings. Explicit folder colors are retained. Unknown source fields/settings are counted or disclosed and remain recoverable from the original backup. Style-toggle/page preset assignments and user notes are retained as inert metadata; there is no corresponding active UI preference. Unsafe CSS and styles without recognized scope are excluded with warnings. Generated scratch CSS is excluded. Theme-source metadata does not enable managed updates.

The normal full exporter has no native autostart enablement/waits or native organizer registry. An installed source may provide those; native startup replacement is opt-in and organizer entries are reported without creating Plus folders. An older export missing plugin autostart settings leaves ownership unmanaged. Unknown ordering references use the existing documented fallback/warnings. Custom icon and User Scripts files are absent from exports; verify them locally and keep original files. Migration does not fetch imported URLs.

Safe limits: 5 MiB full JSON; 5000 folders per type; 5000 explicit/hidden/identity/target entries per folder; 200 actions; 2000 startup sequence/native autostart entries; 160-byte folder names; 255-byte member names; 1024-byte regex; 64-byte Docker ID and 512-byte image hints; validated VM UUIDs; 128 styles/2 MiB total stylesheet input; 64 KiB compiled CSS per profile layer and recovery metadata; 30 imported custom presets and 32 total workspace profiles. General folder nesting remains bounded at six levels. Names and text must be valid UTF-8. Oversized supported configuration is rejected; safety scanning may exclude CSS with an explicit warning.

## Related risk disposition

| Risk | Disposition |
|---|---|
| RISK-01 Dashboard context differences | Explicit unsupported-mode warning and native fallback; host clicks pending. |
| RISK-02 stale post-apply UI | Verified persistence precedes success; shared Settings/Recovery refresh is awaited, failures reported separately; reload open runtime tabs. |
| RISK-03 concurrent edits | Source and destination digest checked under mutation lock; stale-destination and installed-source edit fixtures pass. |
| RISK-04 interrupted transaction | Caught failures compensate captured bytes and retain backups/history; abrupt termination/power loss remains a recovery acceptance case. No multi-file atomicity claim. |
| RISK-05 icon portability | Reference preserved; absent icon binaries/scripts disclosed. Built-in/custom fallback and source removal require host verification. |
| RISK-06 CSS portability | Profiles inactive, safety scan and layer limits retained; selectors/variables require manual preview. |
| RISK-07 malformed/large input | File pre-read and backend size/depth/field limits; invalid/unsupported regex rejection. No claim that arbitrary valid regex has a proven linear execution bound. |
| RISK-08 raw automatic adoption | FolderView3 skipped by old adoption path; explicit validated migration owns the process. FolderView2 behavior retained. |
| RISK-09 duplicates/ambiguous references | Duplicate JSON keys, normalized IDs and duplicate folder names rejected; duplicate explicit ownership uses original first-folder behavior and warns; ambiguous UUIDs retained unresolved. |
| RISK-10 native startup | Existing guarded optional native transaction retained; fixture start-order ownership matches upstream; actual enablement, waits and restart remain host acceptance. |

## M01–M40 coverage checklist

The remediation tests execute parse/validation/preview/conversion/apply/persistence/readback using temporary filesystem roots, and inspect actual saved values and file hashes. Browser fixtures use the shipped controller/report/apply/model modules and production PHP endpoint with a test-only authentication adapter; production authentication is covered separately by the security suites.

| Matrix items | Local coverage or explicit remaining acceptance |
|---|---|
| M01–M03 | Synthetic current envelope, scoped/native parser corpus, historical optional-field absence; production browser full selection. |
| M04–M07 | Required-section, type and malformed JSON rejection; unknown fields disclosed; workspace preview purity. |
| M08–M10 | Boundary collections/long UTF-8 text; strict marker variants and rejection without mutation. |
| M11–M13 | Effective defaults, mapped context/highlight values, overflow aliases, false/zero/null/empty distinction. |
| M14 | VM UUID persistence/unique rename/missing/ambiguous cases; hidden references, identity and editor suites. |
| M15–M20 | Literal whitespace/invalid regex; original evaluator comparisons for manual/label/regex/source-order ownership. |
| M21–M24 | Independent installed reads and stale source/destination rejection; preview hashes unchanged. |
| M25–M27 | Browser file selection, malformed JSON/UTF-8 rejection, preview/report warnings, confirmation dismissal, verified apply, refresh and reload; owned error/old-plan clearing and existing import dialog suites. |
| M28–M30 | Backend editor re-save, rollback compensation and pure workspace inspection; live hidden-row editor interaction remains manual. |
| M31 | Deterministic repeat imports and browser/independent PHP readback; Unraid restart/upgrade pending. |
| M32–M33 | Payload/nesting/collection/regex rejection, dangerous keys and existing security suites; arbitrary regex performance remains bounded-input risk. |
| M34–M35 | Presets/notes/scopes/inactive safety, CSS limits and existing profile-limit protection; real theme portability pending. |
| M36 | Export exclusion disclosure and existing icon fallback tests; real cross-server icon/source removal acceptance pending. |
| M37 | Existing off/folder/custom/native startup fixtures plus actual migrated startup-context membership; native host execution pending. |
| M38 | Destination/source conflicts, stale failed-preview suppression, duplicate-apply/competing-detection guards and disconnected-apply UI suppression executed; multi-tab/host timing acceptance pending. |
| M39 | Caught failure compensation automated; actual process kill/power loss deliberately unverified. |
| M40 | Unknown future fields/settings disclosed and strict version validation; representative private real exports should be tested on a host before stable qualification. |

## Validation results

Environment: Windows with PHP 8.3 and Node 24.14.1; native Linux Node 24.14.1/PHP 8.3 in WSL for the complete shell/POSIX lanes. No live Unraid host was used. Logs and browser screenshots are local ignored artifacts under `tmp/`.

- Baseline focused audit-related suites: 106 discovered, 105 passed, 1 Windows POSIX skip, 0 failures.
- `node --test tests/folderview3-remediation.test.mjs tests/folderview3-migration.test.mjs tests/environment-transaction.test.mjs`: 33 discovered, 32 passed, 1 Windows POSIX skip, 0 failures before the expanded matrix.
- Native Linux `node --test tests/folderview3-remediation.test.mjs`: expanded 21 tests passed, 0 failed/skipped; includes full 5000-member persistence and original upstream comparison.
- `bash scripts/run_ci_suite.sh --lane lint --lane tests`: final native Linux run passed, 1457 tests discovered, 1456 passed, 1 skipped, 0 failures; separate coverage lane 96 passed. The skip is the FastCGI icon-part upload test because PHP FastCGI is unavailable. PHP/JS syntax, unused-helper checks, architecture/load boundaries, test-runner inventory, CSP and coverage gates passed.
- Focused run including remediation, controller concurrency, previous migration/environment, theme profiles and runner contracts: 53 passed, 0 failed/skipped before the final picker/lifecycle cases. Additional identity/controller run: 28 passed, 0 failed/skipped; final controller ownership/lifecycle cases: 4 passed.
- Complete Chromium browser fixture suite: 259 passed, 0 failed. The migration matrix was then rerun with the actual editor serialization block: 24 passed, 0 failed.
- Runtime component and production Settings/Docker startup performance budgets passed, including cold/warm, representative/small/normal/extreme and RTL cases. No performance baseline or budget was weakened.
- `node scripts/build_i18n_surface_catalogs.mjs --translate` completed for all 27 locales. Fixed PHP messages use the existing reviewed semantic server registry; the language usage guard reports zero uncovered strings and the existing automatic-key budget remains unchanged. Newly generated values were checked for English fallback and placeholder integrity; critical replacement/stale-preview wording was reviewed across locales and incorrect application/submission wording corrected in the shared reviewed overrides. The production startup check caught missing new control keys; those were added and regenerated before its successful rerun.
- Browser migration profile with Chromium, Firefox and WebKit, light/dark, 1180×720 and 390×844: 24 passed, 0 failed; fixture accessibility gate enabled.
- Initial Windows full-suite run exposed stale migration UI/inventory assertions, a missing CI classification, a fixture include-path assumption, and Windows shell fixture differences. Focused corrections retained the historical PHP API fingerprint and existing guard ceilings. Native Linux rerun passed. Interrupted catalog generation was rerun successfully; catalog metadata/coverage failures were not bypassed.

- `bash pkg_build.sh --branch dev --install-smoke` completed for `2026.10.13.07`. The first build's unsupported release-note categories were corrected to the repository's allowed categories and the same version rebuilt; no invalid package was published.
- `bash scripts/run_ci_suite.sh --lane guards --lane docs-guards` passed: release/install/API/legacy/localization/language-usage/load-order/theme/dead-code/performance-budget/reproducibility/documentation/release-note/workflow guards. The main-history check is intentionally skipped on `dev`. The localization budget remains 3030/3089 automatic keys with 1634 explicit keys; no ceiling was increased.
- Two deterministic rebuilds matched the candidate archive. Final SHA-256: `75f62bd934e70985928d627a6e77df885de0c029b3c6da5fef38e01d49a84f02`. Runtime integrity verification covered 316 files. Normal archive retention removes the oldest `2026.10.09.04` archive/checksum pair.
- Local instruction files, the earlier audit, diagnostic evidence, generated probes and temporary validation artifacts are excluded. Only implementation, regressions, documentation, catalogs and the dev package are intended for the associated commit.

Commit/push and raw publication checks occur after these local quality gates and are recorded in the completion response. The package is not production-qualified by these local checks.

## Manual Unraid acceptance for the dev package

1. Back up both plugins' configuration directories and keep an off-host copy of the full FolderView3 export. Use a test host or a recoverable maintenance window. Disable/remove the old rendering plugin before validating Plus rendering; retain its data and assets.
2. Install `plugin install https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/dev/folderview.plus.plg`, confirm version `2026.10.13.07`, and hard-refresh the webGUI.
3. On a clean Plus installation, detect installed FolderView3 in Advanced → Recovery → Additional tools. Confirm the preview makes no configuration/assets changes. Repeat with a full backup and an early backup without startup/order additions.
4. On an already configured Plus installation, preview the same backup, review the replacement warning, and cancel. Confirm both existing types, preferences, active appearance and native autostart remain unchanged.
5. Import the full file through Basic Docker/VM Import and through Recovery Import Environment. Confirm both routes reach full migration, not a successful single-type import. Try genuine per-type/single-folder/native exports separately.
6. Apply after review. Confirm a verified result, both type maps, rules/defaults, assignments/counts and newly available recovery checkpoints. Reload Settings, Docker, VMs and Dashboard.
7. Test explicit membership in a later folder against an earlier matching regex, a valid Docker label against regex, duplicate matches and source order different from saved folder order. Confirm runtime pages, conflict report, bulk-action membership and startup preview agree before running actions.
8. Check overflow modes 0/1/2, row separators, context trigger/graph/time, folder update highlight and inherited defaults. Confirm explicit false/zero overrides. Open and re-save affected folders, reload and compare again.
9. Verify VM UUID-based rename, a temporarily unavailable member returning, ambiguous identity handling, and hidden regex members surviving disappearance/reload/editor saves.
10. Test startup ownership off/folder/custom. Leave native replacement unchecked and compare enablement/waits; then use an installed source with native entries and explicitly opt in. Verify order/waits without unexpectedly enabling additional containers. Restart Docker/host only after confirming the intended state.
11. Inspect inactive presets and recovery metadata through a native environment export; preview safe CSS in each scope before activation. Verify custom/built-in icons and User Scripts exist. Recheck after removing the source plugin.
12. Make a configuration edit between preview and apply and confirm stale review rejection. Exercise a normal failure and restore the pre-migration global checkpoint from Recovery. On a disposable host, simulate interrupted apply and restore both types/appearance/native startup together.
13. Reload/restart and confirm persistence. Test narrow/touch UI, keyboard navigation, light/dark themes and repeated navigation without duplicate handlers. If a problem remains, provide a fresh sanitized support bundle and sanitized screenshots; keep raw exports private.

No stable branch promotion or production release is authorized by this work. Live rendering, host startup behavior, real icon/theme portability and abrupt process/power failure remain explicitly unverified acceptance items rather than locally confirmed defects.
