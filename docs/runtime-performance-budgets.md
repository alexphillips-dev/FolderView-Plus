# Runtime performance budgets

FolderView Plus validates browser runtime performance in addition to static asset and package size. The required Chromium benchmark uses deterministic fixtures so the same workloads run locally, in pull requests, on `dev`, and during release validation without requiring a live Unraid host.

## Scenario matrix

| Scenario | Folders | Members |
| --- | ---: | ---: |
| Small | 25 | 50 |
| Normal | 100 | 500 |
| Extreme | 250 | 2,000 |

Each scenario measures navigation-to-native-row visibility, one-shot folder grouping, Settings bootstrap, modern folder editor opening, a normalized 50-event start/stop reconciliation workload, Update-All reconciliation, maximum DOM nodes, MutationObserver callbacks, retained heap after 30 view switches, and Docker bootstrap network requests.

## Regression policy

The runner performs one warm-up and five fresh-page measurements, then evaluates the median. Every metric must remain below both:

- The absolute ceiling in `scripts/runtime_perf_budgets.json`.
- The tracked median in `scripts/runtime_perf_baseline.json` plus the configured meaningful-regression allowance.

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
