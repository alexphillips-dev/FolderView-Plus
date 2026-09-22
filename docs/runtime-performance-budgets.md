# Runtime performance budgets

FolderView Plus validates browser runtime performance in addition to static asset and package size. The required Chromium benchmark uses deterministic fixtures so the same workloads run locally, in pull requests, on `dev`, and during release validation without requiring a live Unraid host.

## Scenario matrix

| Scenario | Folders | Members |
| --- | ---: | ---: |
| Small | 25 | 50 |
| Normal | 100 | 500 |
| Extreme | 250 | 2,000 |

The component fixtures measure navigation-to-native-row visibility, one-shot folder grouping, Settings bootstrap, modern folder editor opening, a normalized 50-event start/stop reconciliation workload, Update-All reconciliation, maximum DOM nodes, MutationObserver callbacks, retained heap after 30 view switches, and Docker bootstrap network requests. These isolated fixtures do not represent full production startup.

## Production startup stage

The same required command also runs `scripts/production_performance_benchmarks.mjs`. This stage serves the shipped Settings markup, Settings foundation/workspace manifest, Docker bootstrap, runtime scripts, styles and localization catalogs through an isolated loopback HTTP server. Plugin startup functions are not replaced with benchmark implementations. Only Unraid host widgets, host hooks and API responses are synthetic; this does not measure PHP execution, server storage, real network latency or Unraid widget rendering.

Both Settings and Docker run the three sizes above, plus an Arabic RTL small workload. Small uses English; normal and extreme use German. Each case has three fresh browser contexts, with a cold navigation followed by a repeat navigation in the same context. Repeat navigation must demonstrate actual browser script-cache reuse. No Playwright request routing disables that cache.

Docker also runs a representative English workload: 23 folders (16 roots and seven children) and 51 uniquely assigned synthetic containers. No private configuration is copied into this fixture. It checks exact member ownership, nesting depth, centered root labels, and expand/collapse without replacing native member nodes. Three cold/warm pairs use the same shipped startup path as the stress cases. Missing startup stages fail validation.

The representative baseline was measured before removing repeated all-folder centering from individual shell insertion. Median cold/warm readiness was 412.9/309.0 ms, folder-row construction 119.6/107.3 ms, and longest main-thread task 180/156 ms. These pre-optimization values remain in the tracked baseline; existing cases and their limits were not relaxed. The focused optimization centers the completed tree once before the visible width commit. Local before/after reports are retained in the benchmark artifact directory during validation.

Final same-machine representative validation (Chromium 153.0.8010.12, three cold/warm pairs, synthetic APIs):

| Metric | Before | After |
| --- | ---: | ---: |
| Cold readiness | 412.9 ms | 353.6 ms |
| Warm readiness | 309.0 ms | 236.3 ms |
| Cold longest task | 180 ms | 129 ms |
| Warm longest task | 156 ms | 95 ms |

The full suite passed all 54 startup samples; the final representative rerun also verifies each child's expected parent. `docker-stages.md` and `report.json` expose the stage measurements. The improvement does not predict a specific server's wall-clock load time, and pauses over 50 ms remain even at the representative size.

Docker support telemetry now starts at bootstrap, before provider preparation and runtime asset loading. It records aggregate durations for `providerPreparation`, `customScripts`, `runtimeAsset` (fetch plus evaluation), `renderDataWait`, `renderPreparation`, `folderRows` (including previews), `folderFinalization`, `folderGrouping`, `postRenderPolish` (initial scheduling only), and `detailHydration` (detail application, excluding network wait). Milestones include runtime entry/load, native rows at grouping entry, grouped folders and hydrated details. No folder/member identifiers are added. The existing bounded collector persists these stages for support export. Milestone times are relative to this earlier collector start, so they must not be directly compared with older bundles that started the collector inside `docker.js`. Browser benchmark readiness remains relative to navigation and is comparable across the optimization.

The starting workload uses the standard performance profile with eager previews and a synthetic legacy Docker API fallback. Adaptive/deferred preview configurations and GraphQL-backed server performance are outside this startup baseline; the existing component and compatibility checks remain separate.

Readiness requires the expected folder count and completed localization; Settings additionally requires successful, non-degraded bootstrap. Measurements cover readiness, long tasks, longest frame gap, DOM size, mutation callbacks/records, resource and script requests, transferred bytes and cached scripts. `settledMs` is the end of the fixed 1,200 ms post-readiness observation window, after Settings hydration; it is not a claim that every background task has become idle. Raw samples remain in the JSON report.

`scripts/production_perf_budgets.json` enforces absolute ceilings and regression allowances against `scripts/production_perf_baseline.json`. Invalid or missing measurements, missing baseline entries, failed requests, unexpected JavaScript errors, unexpected missing translations, skipped production entry points/workspace scripts, incomplete folder rendering and ineffective warm caching fail the stage. Updating a baseline still enforces absolute ceilings. The ceilings are regression safeguards, not acceptable user-experience targets.

The retained pre-optimization baseline exposes roughly 55–57 seconds of Docker startup and a 37–38-second longest task at the extreme size. After batching initial centering, the full validation run measured roughly 37–38 seconds to readiness and a 23-second longest task. This is still a substantial scaling limitation. That case retains its explicit starting ceilings separate from the smaller cases; they are not responsiveness targets. Each sample has a 120-second watchdog so a blocked renderer cannot hang the suite indefinitely. Further optimization should measure the remaining work before tightening these ceilings.

The initial baseline records two existing Settings console errors (`activityFeedEntries` and `prefsByType` initialization). These exact known issues are reported and bounded; additional errors fail. The Settings performance-label lookup that previously requested the unloaded `editor.actions.standard` key has been corrected to use the shared catalog. Missing translation keys are no longer allowed in any startup case.

Production reports are written to `tmp/fixture-browser-artifacts/production-performance/`. Compare measurements on the same machine/browser without concurrent CPU-heavy validation. Synthetic timings identify scaling and regressions; they are not predictions of a particular Unraid server's load time.

Run or deliberately refresh just this stage with:

```bash
node scripts/production_performance_benchmarks.mjs
node scripts/production_performance_benchmarks.mjs --update-baseline
node scripts/production_performance_benchmarks.mjs --scenario=representative
```

Adding `--update-baseline` to a selected scenario updates only that scenario's cases; it preserves all other baseline measurements. Review and retain the pre-change measurements before any intentional baseline update.

## Regression policy

The component runner performs one warm-up and five fresh-page measurements, then evaluates the median. Every metric must remain below both:

- The absolute ceiling in `scripts/runtime_perf_budgets.json`.
- The tracked median in `scripts/runtime_perf_baseline.json` plus the configured meaningful-regression allowance.

Timing allowances include a general scheduling-noise floor and may define a larger metric-specific floor when the measurement includes browser navigation or first-paint scheduling. In particular, `nativeRowsVisibleMs` keeps a 250 ms allowance because hosted runners can delay initial paint while still completing the full folder grouping faster than the tracked baseline. The absolute scenario ceiling remains enforced, so this avoids infrastructure-only failures without turning off the first-visible-row budget.

Timing comparisons use a percentage allowance and a minimum millisecond noise floor. Counts use a smaller percentage allowance with deterministic count floors. Retained heap uses a separate percentage and byte floor. This ignores inconsequential timer noise while still catching substantial runtime, DOM, observer, memory, or request growth.

Reports are written to `tmp/fixture-browser-artifacts/runtime-performance/` as JSON and Markdown and are retained by the existing fixture-browser CI artifact upload.

## Local use

Run the enforced benchmark:

```bash
npm run test:runtime-performance
```

When an intentional optimization or fixture change establishes a new expected result, regenerate the baseline and review the diff before committing it:

```bash
node scripts/runtime_performance_benchmarks.mjs --update-baseline
node scripts/runtime_performance_benchmarks.mjs
```

Do not refresh the baseline merely to make a regression pass. The JSON report identifies the scenario, metric, median, absolute ceiling, baseline, and effective limit that failed.
