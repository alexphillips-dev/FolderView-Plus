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

The starting workload uses the standard performance profile with eager previews and a synthetic legacy Docker API fallback. Adaptive/deferred preview configurations and GraphQL-backed server performance are outside this startup baseline; the existing component and compatibility checks remain separate.

Readiness requires the expected folder count and completed localization; Settings additionally requires successful, non-degraded bootstrap. Measurements cover readiness, long tasks, longest frame gap, DOM size, mutation callbacks/records, resource and script requests, transferred bytes and cached scripts. `settledMs` is the end of the fixed 1,200 ms post-readiness observation window, after Settings hydration; it is not a claim that every background task has become idle. Raw samples remain in the JSON report.

`scripts/production_perf_budgets.json` enforces absolute ceilings and regression allowances against `scripts/production_perf_baseline.json`. Invalid or missing measurements, missing baseline entries, failed requests, unexpected JavaScript errors, unexpected missing translations, skipped production entry points/workspace scripts, incomplete folder rendering and ineffective warm caching fail the stage. Updating a baseline still enforces absolute ceilings. The ceilings are regression safeguards, not acceptable user-experience targets.

The reviewed baseline exposes roughly 55–57 seconds of Docker startup and a 37–38-second longest task at the extreme size. That case has explicit starting ceilings separate from the smaller cases; it must remain visible as an optimization target. Each sample has a 120-second watchdog so a blocked renderer cannot hang the suite indefinitely. Tighten the baseline and relevant ceilings after the planned runtime improvements.

The initial baseline records two existing Settings console errors (`activityFeedEntries` and `prefsByType` initialization). These exact known issues are reported and bounded; additional errors fail. The Settings performance-label lookup that previously requested the unloaded `editor.actions.standard` key has been corrected to use the shared catalog. Missing translation keys are no longer allowed in any startup case.

Production reports are written to `tmp/fixture-browser-artifacts/production-performance/`. Compare measurements on the same machine/browser without concurrent CPU-heavy validation. Synthetic timings identify scaling and regressions; they are not predictions of a particular Unraid server's load time.

Run or deliberately refresh just this stage with:

```bash
node scripts/production_performance_benchmarks.mjs
node scripts/production_performance_benchmarks.mjs --update-baseline
```

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
